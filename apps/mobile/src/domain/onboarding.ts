import type { BusinessAnalysis } from '@/services/analysis/BusinessAnalysisService';
import type { AudienceProfile, BusinessProfile, ContentGoal, ContentPlaybook, ValueProposition, VoiceTrait } from './types';

/**
 * Onboarding is a linear list of steps after account creation. The draft
 * records the step to resume at, so closing the app never loses progress.
 */
export const ONBOARDING_STEPS = [
  'website',
  'analyzing',
  'business',
  'audience',
  'value',
  'goals',
  'voice',
  'playbook',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingDraft {
  version: 1;
  /** Where the user resumes. Advances only when a step is confirmed. */
  step: OnboardingStep;
  completed: boolean;
  /** Server id once the business row exists (Supabase mode). */
  businessId?: string;
  websiteUrl?: string;
  /** Raw AI output, kept so we can show "AI suggested" and never re-run needlessly. */
  analysis?: BusinessAnalysis;
  business?: BusinessProfile;
  audience?: AudienceProfile;
  valueProposition?: ValueProposition;
  goals: ContentGoal[];
  voiceTraits: VoiceTrait[];
  updatedAt: string;
}

export function emptyDraft(): OnboardingDraft {
  return { version: 1, step: 'website', completed: false, goals: [], voiceTraits: [], updatedAt: new Date().toISOString() };
}

/** Progress (0–1) for the thin bar at the top of onboarding. */
export function stepProgress(step: OnboardingStep): number {
  // Account creation counts as the first step already done.
  const index = ONBOARDING_STEPS.indexOf(step) + 1;
  return index / (ONBOARDING_STEPS.length + 1);
}

/** Never move backwards when confirming an earlier step during a review edit. */
export function furthestStep(a: OnboardingStep, b: OnboardingStep): OnboardingStep {
  return ONBOARDING_STEPS.indexOf(a) >= ONBOARDING_STEPS.indexOf(b) ? a : b;
}

export function playbookFromDraft(draft: OnboardingDraft): ContentPlaybook | null {
  if (!draft.business || !draft.audience || !draft.valueProposition) return null;
  return {
    business: draft.business,
    audience: draft.audience,
    valueProposition: draft.valueProposition,
    preferences: { goals: draft.goals, voiceTraits: draft.voiceTraits },
  };
}
