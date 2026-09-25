import { OnboardingDraft, OnboardingStep, ONBOARDING_STEPS, emptyDraft } from '@/domain/onboarding';
import type { ContentGoal, ContentIdea, ContentIdeaStatus, VoiceTrait } from '@/domain/types';
import { getSupabase } from '@/lib/supabase';
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
        .select(
          '*, audience_profiles(*), value_propositions(*), content_preferences(*), content_playbooks(*), business_analyses(result, analyzed_at)',
        )
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
    const analyses = (Array.isArray(b.business_analyses) ? b.business_analyses : []) as any[];
    const latest = analyses.sort((x, y) => String(y.analyzed_at).localeCompare(String(x.analyzed_at)))[0];
    const step = (ONBOARDING_STEPS as readonly string[]).includes(playbook?.onboarding_step)
      ? (playbook.onboarding_step as OnboardingStep)
      : 'business';

    return {
      ...emptyDraft(),
      step,
      completed: Boolean(playbook?.onboarding_completed),
      businessId: b.id,
      websiteUrl: b.website_url,
      analysis: latest?.result ?? undefined,
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
    const db = getSupabase();
    const { business } = draft;
    const businessRow = {
      user_id: userId,
      name: business.name,
      website_url: business.websiteUrl,
      industry: business.industry,
      description: business.description,
      primary_location: business.primaryLocation,
      services: business.services,
    };

    let businessId = draft.businessId;
    if (businessId) {
      check(await db.from('businesses').update(businessRow).eq('id', businessId));
    } else {
      const inserted = check(await db.from('businesses').insert(businessRow).select('id').single()) as { id: string };
      businessId = inserted.id;
    }

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
    if (draft.analysis) {
      writes.push(
        db.from('business_analyses').upsert(
          {
            business_id: businessId,
            website_url: draft.analysis.business.websiteUrl,
            provider: draft.analysis.provider,
            result: draft.analysis,
            analyzed_at: draft.analysis.analyzedAt,
          },
          { onConflict: 'business_id,analyzed_at', ignoreDuplicates: true },
        ),
      );
    }
    if (draft.audience) {
      writes.push(
        db.from('audience_profiles').upsert({
          business_id: businessId,
          summary: draft.audience.summary,
          structured_attributes: draft.audience.structuredAttributes,
          ai_suggested_summary: draft.analysis?.audience.summary ?? null,
        }),
      );
    }
    if (draft.valueProposition) {
      writes.push(
        db.from('value_propositions').upsert({
          business_id: businessId,
          summary: draft.valueProposition.summary,
          ai_suggested_summary: draft.analysis?.valueProposition.summary ?? null,
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
