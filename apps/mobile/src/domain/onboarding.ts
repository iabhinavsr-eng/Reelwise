import type { BusinessAnalysis, ManualBusinessInput } from '@/services/analysis/BusinessAnalysisService';
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
  /** Raw AI output (the SUGGESTION), kept so we can show "AI suggested" and never re-run needlessly. */
  analysis?: BusinessAnalysis;
  /** Server job being polled; lets a restarted app resume instead of re-analyzing. */
  pendingAnalysisId?: string;
  /** Owner answers from the "couldn't learn enough" fallback, until analysis succeeds. */
  manualInput?: ManualBusinessInput;
  /** Working copies the user edits. Authoritative once approved. */
  business?: BusinessProfile;
  audience?: AudienceProfile;
  valueProposition?: ValueProposition;
  goals: ContentGoal[];
  voiceTraits: VoiceTrait[];
  /** When the user approved each section (ISO time). Approved sections are never overwritten by a new analysis. */
  approved?: Partial<Record<ApprovableSection, string>>;
  updatedAt: string;
}

export type ApprovableSection = 'business' | 'audience' | 'valueProposition' | 'goals' | 'voiceTraits';

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

/** Marks a section as approved by the user (call when they confirm a step). */
export function approve(draft: OnboardingDraft, section: ApprovableSection): OnboardingDraft['approved'] {
  return { ...draft.approved, [section]: new Date().toISOString() };
}

/**
 * Applies a (new) analysis as SUGGESTIONS. Sections the user already
 * approved keep the user's version; the new suggestion is still stored in
 * `analysis`, so screens can offer "Use suggestion". Never silently replaces
 * approved information.
 */
export function applyAnalysis(draft: OnboardingDraft, analysis: BusinessAnalysis): Partial<OnboardingDraft> {
  const approved = draft.approved ?? {};
  return {
    analysis,
    pendingAnalysisId: undefined,
    manualInput: undefined,
    websiteUrl: draft.websiteUrl ?? analysis.business.websiteUrl,
    business: approved.business && draft.business ? draft.business : analysis.business,
    audience: approved.audience && draft.audience ? draft.audience : analysis.audience,
    valueProposition: approved.valueProposition && draft.valueProposition ? draft.valueProposition : analysis.valueProposition,
    goals: approved.goals || draft.goals.length ? draft.goals : analysis.suggestedGoals,
    voiceTraits: approved.voiceTraits || draft.voiceTraits.length ? draft.voiceTraits : analysis.suggestedVoiceTraits,
  };
}

/** True when an approved business profile differs from the latest suggestion. */
export function businessDiffersFromSuggestion(draft: OnboardingDraft): boolean {
  const a = draft.analysis?.business;
  const b = draft.business;
  if (!a || !b) return false;
  return (
    a.name !== b.name ||
    a.industry !== b.industry ||
    a.primaryLocation !== b.primaryLocation ||
    a.description !== b.description ||
    a.services.join('|') !== b.services.join('|')
  );
}
