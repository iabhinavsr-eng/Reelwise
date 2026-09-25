import { describe, expect, it } from 'vitest';

import type { BusinessAnalysis } from '@/services/analysis/BusinessAnalysisService';
import { mapServerResult } from '@/services/analysis/mapServerResult';
import { completedStages } from '@/services/analysis/progress';
import type { ServerAnalysisResult } from '@/services/api/types';
import { applyAnalysis, approve, businessDiffersFromSuggestion, emptyDraft, OnboardingDraft } from './onboarding';

const analysis = (tag: string): BusinessAnalysis => ({
  business: { name: `Biz ${tag}`, websiteUrl: 'https://biz.com/', industry: 'Plumbing', primaryLocation: 'Columbus, OH', description: `desc ${tag}`, services: [`svc ${tag}`] },
  audience: { summary: `audience ${tag}`, structuredAttributes: { customerTypes: ['Homeowners'] } },
  valueProposition: { summary: `uvp ${tag}` },
  suggestedGoals: ['educate'],
  suggestedVoiceTraits: ['warm'],
  provider: 'api',
  analyzedAt: '2026-01-01T00:00:00Z',
  analysisId: `id-${tag}`,
});

describe('applyAnalysis — suggested vs approved', () => {
  it('fills every section from the first analysis', () => {
    const next = applyAnalysis(emptyDraft(), analysis('v1'));
    expect(next.business?.name).toBe('Biz v1');
    expect(next.audience?.summary).toBe('audience v1');
    expect(next.valueProposition?.summary).toBe('uvp v1');
    expect(next.goals).toEqual(['educate']);
    expect(next.voiceTraits).toEqual(['warm']);
  });

  it('never overwrites sections the user approved, but keeps the new suggestion alongside', () => {
    let draft: OnboardingDraft = { ...emptyDraft(), ...applyAnalysis(emptyDraft(), analysis('v1')) };
    // User edits + approves the audience and business; value prop is untouched.
    draft = { ...draft, audience: { summary: 'Landlords with old buildings', structuredAttributes: {} }, approved: approve(draft, 'audience') };
    draft = { ...draft, business: { ...draft.business!, name: 'My Real Name' }, approved: approve(draft, 'business') };
    draft = { ...draft, goals: ['get_leads'], approved: approve(draft, 'goals') };

    const next = { ...draft, ...applyAnalysis(draft, analysis('v2')) };
    expect(next.audience?.summary).toBe('Landlords with old buildings'); // approved → kept
    expect(next.business?.name).toBe('My Real Name'); // approved → kept
    expect(next.valueProposition?.summary).toBe('uvp v2'); // not approved → refreshed
    expect(next.goals).toEqual(['get_leads']);
    expect(next.analysis?.audience.summary).toBe('audience v2'); // suggestion still available
    expect(next.analysis?.analysisId).toBe('id-v2');
    expect(businessDiffersFromSuggestion(next)).toBe(true);
  });

  it('clears the pending job and manual answers once an analysis lands', () => {
    const draft = { ...emptyDraft(), pendingAnalysisId: 'job', manualInput: { businessName: 'x', whatYouDo: 'y' } };
    const next = applyAnalysis(draft, analysis('v1'));
    expect(next.pendingAnalysisId).toBeUndefined();
    expect(next.manualInput).toBeUndefined();
  });
});

describe('mapServerResult', () => {
  const server: ServerAnalysisResult = {
    analysisId: 'a1',
    version: 3,
    pipelineVersion: 'p',
    mode: 'website',
    websiteUrl: 'https://candles.com/',
    analyzedAt: '2026-01-01T00:00:00Z',
    business: {
      name: null,
      website: 'https://candles.com/',
      industry: null,
      description: null,
      locations: [],
      serviceAreas: [],
      services: [],
      products: [{ value: 'Cedar candle', sources: ['https://candles.com/products/cedar'] }],
    },
    audience: { summary: 'Gift buyers', customerTypes: ['Gift buyers'], needs: [], painPoints: ['Generic gifts'], motivations: [], behaviors: [], locations: [], ageRanges: [] },
    valueProposition: { summary: 'Hand-poured', differentiators: [], problemsSolved: [], benefits: [] },
    brandVoice: { suggestedTraits: ['playful'], observedTone: null },
    suggestedGoals: ['grow_followers'],
    evidence: [],
    inferences: [],
    confidence: { name: 'low', industry: 'low', services: 'high', locations: 'low', audience: 'medium', valueProposition: 'medium' },
  };

  it('maps nulls to empty editable fields, falls back to products, and keeps structured ICP + details', () => {
    const a = mapServerResult(server);
    expect(a.business).toEqual({ name: '', websiteUrl: 'https://candles.com/', industry: '', primaryLocation: '', description: '', services: ['Cedar candle'] });
    expect(a.audience.structuredAttributes.painPoints).toEqual(['Generic gifts']);
    expect(a.suggestedVoiceTraits).toEqual(['playful']);
    expect(a.analysisId).toBe('a1');
    expect(a.version).toBe(3);
    expect(a.details).toBe(server);
  });
});

describe('completedStages (real progress)', () => {
  it('ticks stages only on real server milestones', () => {
    expect(completedStages({ status: 'queued', phase: null })).toBe(0);
    expect(completedStages({ status: 'crawling', phase: null })).toBe(0);
    expect(completedStages({ status: 'analyzing', phase: 'profile' })).toBe(1);
    expect(completedStages({ status: 'analyzing', phase: 'positioning' })).toBe(3);
    expect(completedStages({ status: 'completed', phase: null })).toBe(5);
  });
});
