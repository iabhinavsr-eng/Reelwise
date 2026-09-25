import { OnboardingDraft, OnboardingStep, ONBOARDING_STEPS, emptyDraft } from '@/domain/onboarding';
import type { ContentGoal, ContentIdea, ContentIdeaStatus, VoiceTrait } from '@/domain/types';
import { getSupabase } from '@/lib/supabase';
import { mapServerResult } from '@/services/analysis/mapServerResult';
import type { ServerAnalysisResult } from '@/services/api/types';
import type { ProfileRepository } from './ProfileRepository';

/* eslint-disable @typescript-eslint/no-explicit-any -- row shapes come from PostgREST */

/** PostgREST returns one-to-one embeds as an object, but be tolerant of arrays. */
const one = <T,>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value ?? undefined;

function check<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error;
  return data;
}

function ideaFromRow(row: any): ContentIdea {
  return {
    id: row.id,
    businessId: row.business_id,
    contentType: row.content_type,
    title: row.title,
    description: row.description,
    status: row.status,
    objective: row.objective ?? undefined,
    platform: row.platform ?? undefined,
    targetLengthSeconds: row.target_length_seconds ?? undefined,
    callToAction: row.call_to_action ?? undefined,
    createdAt: row.created_at,
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  async loadDraft(userId: string): Promise<OnboardingDraft | null> {
    const rows = check(
      await getSupabase()
        .from('businesses')
        // business_analyses is loaded separately below: the tables reference each other both ways, so an embed would be ambiguous.
        .select('*, audience_profiles(*), value_propositions(*), content_preferences(*), content_playbooks(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1),
    ) as any[];
    const b = rows?.[0];
    if (!b) return null;

    const audience = one<any>(b.audience_profiles);
    const value = one<any>(b.value_propositions);
    const prefs = one<any>(b.content_preferences);
    const playbook = one<any>(b.content_playbooks);
    // The analysis the approved profile came from (suggestions for "Use suggestion").
    let analysis: OnboardingDraft['analysis'];
    if (b.current_analysis_id) {
      const { data } = await getSupabase().from('business_analyses').select('result, status').eq('id', b.current_analysis_id).maybeSingle();
      if (data?.status === 'completed' && data.result) analysis = mapServerResult(data.result as ServerAnalysisResult);
    }
    const approvedAt = (value: string | null | undefined) => value ?? undefined;
    const step = (ONBOARDING_STEPS as readonly string[]).includes(playbook?.onboarding_step)
      ? (playbook.onboarding_step as OnboardingStep)
      : 'business';

    return {
      ...emptyDraft(),
      step,
      completed: Boolean(playbook?.onboarding_completed),
      businessId: b.id,
      websiteUrl: b.website_url,
      analysis,
      approved: {
        business: approvedAt(b.profile_approved_at),
        audience: approvedAt(audience?.approved_at),
        valueProposition: approvedAt(value?.approved_at),
      },
      business: {
        name: b.name,
        websiteUrl: b.website_url,
        industry: b.industry,
        primaryLocation: b.primary_location,
        description: b.description,
        services: b.services ?? [],
      },
      audience: audience && { summary: audience.summary, structuredAttributes: audience.structured_attributes ?? {} },
      valueProposition: value && { summary: value.summary },
      goals: (prefs?.goals ?? []) as ContentGoal[],
      voiceTraits: (prefs?.voice_traits ?? []) as VoiceTrait[],
      updatedAt: playbook?.updated_at ?? b.updated_at,
    };
  }

  async saveDraft(userId: string, draft: OnboardingDraft): Promise<OnboardingDraft> {
    // Nothing to store server-side until the analysis has produced a business.
    if (!draft.business) return draft;
    // Only server analyses exist as rows; mock/demo analyses live on-device.
    const analysisId = draft.analysis?.provider === 'api' ? draft.analysis.analysisId ?? null : null;
    try {
      return await this.write(userId, draft, analysisId);
    } catch (e) {
      // The analysis row may not exist in this database (e.g. an API running
      // with its in-memory store). Save the approved profile without the link.
      if (analysisId && (e as { code?: string })?.code === '23503') return this.write(userId, draft, null);
      throw e;
    }
  }

  private async write(userId: string, draft: OnboardingDraft, analysisId: string | null): Promise<OnboardingDraft> {
    const db = getSupabase();
    const business = draft.business!;
    const analysis = draft.analysis;
    const approved = draft.approved ?? {};
    const businessRow = {
      user_id: userId,
      name: business.name,
      website_url: business.websiteUrl,
      industry: business.industry,
      description: business.description,
      primary_location: business.primaryLocation,
      services: business.services,
      current_analysis_id: analysisId,
      profile_approved_at: approved.business ?? null,
    };

    let businessId = draft.businessId;
    if (businessId) {
      check(await db.from('businesses').update(businessRow).eq('id', businessId));
    } else {
      const inserted = check(await db.from('businesses').insert(businessRow).select('id').single()) as { id: string };
      businessId = inserted.id;
    }

    // APPROVED data. Suggestions live in business_analyses (written by the API only).
    const writes: PromiseLike<{ error: unknown }>[] = [
      db.from('content_playbooks').upsert({
        business_id: businessId,
        onboarding_step: draft.step,
        onboarding_completed: draft.completed,
        completed_at: draft.completed ? new Date().toISOString() : null,
      }),
      db.from('content_preferences').upsert({
        business_id: businessId,
        goals: draft.goals,
        voice_traits: draft.voiceTraits,
      }),
    ];
    if (draft.audience) {
      const suggested = analysis?.audience.summary ?? null;
      writes.push(
        db.from('audience_profiles').upsert({
          business_id: businessId,
          summary: draft.audience.summary,
          structured_attributes: draft.audience.structuredAttributes,
          ai_suggested_summary: suggested,
          source_analysis_id: analysisId,
          user_edited: suggested !== null && suggested.trim() !== draft.audience.summary.trim(),
          approved_at: approved.audience ?? null,
        }),
      );
    }
    if (draft.valueProposition) {
      const suggested = analysis?.valueProposition.summary ?? null;
      const details = analysis?.details?.valueProposition;
      writes.push(
        db.from('value_propositions').upsert({
          business_id: businessId,
          summary: draft.valueProposition.summary,
          ai_suggested_summary: suggested,
          structured: details
            ? {
                differentiators: details.differentiators.map((d) => d.value),
                problems_solved: details.problemsSolved,
                benefits: details.benefits,
              }
            : {},
          source_analysis_id: analysisId,
          user_edited: suggested !== null && suggested.trim() !== draft.valueProposition.summary.trim(),
          approved_at: approved.valueProposition ?? null,
        }),
      );
    }
    for (const result of await Promise.all(writes)) check({ data: null, error: result.error });
    return { ...draft, businessId };
  }

  async listIdeas(_userId: string, businessId: string) {
    const rows = check(
      await getSupabase()
        .from('content_ideas')
        .select('*')
        .eq('business_id', businessId)
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false }),
    ) as any[];
    return rows.map(ideaFromRow);
  }

  async saveIdeas(_userId: string, ideas: ContentIdea[]) {
    if (ideas.length === 0) return [];
    const rows = check(
      await getSupabase()
        .from('content_ideas')
        .insert(
          ideas.map((i) => ({
            business_id: i.businessId,
            content_type: i.contentType,
            title: i.title,
            description: i.description,
            status: i.status,
            objective: i.objective ?? null,
            platform: i.platform ?? null,
            target_length_seconds: i.targetLengthSeconds ?? null,
            call_to_action: i.callToAction ?? null,
            source: 'system',
          })),
        )
        .select('*'),
    ) as any[];
    return rows.map(ideaFromRow);
  }

  async updateIdeaStatus(_userId: string, ideaId: string, status: ContentIdeaStatus) {
    check(await getSupabase().from('content_ideas').update({ status }).eq('id', ideaId));
  }
}
