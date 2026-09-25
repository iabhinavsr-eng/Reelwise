import { router } from 'expo-router';

import type { OnboardingStep } from '@/domain/onboarding';

export const stepHref = (step: OnboardingStep) => `/onboarding/${step}` as const;

/** Steps you return to when pressing back (analysis is skipped). */
const PREVIOUS: Partial<Record<OnboardingStep, OnboardingStep>> = {
  business: 'website',
  audience: 'business',
  value: 'audience',
  goals: 'value',
  voice: 'goals',
  playbook: 'voice',
};

export function previousStep(step: OnboardingStep) {
  return PREVIOUS[step];
}

export function goBackFrom(step: OnboardingStep) {
  if (router.canGoBack()) return router.back();
  const prev = PREVIOUS[step];
  if (prev) router.replace(stepHref(prev));
}

/**
 * After confirming a step: in review mode (editing from the Playbook) return
 * to the Playbook; otherwise continue forward.
 */
export function continueTo(next: OnboardingStep, review: boolean) {
  if (review && router.canGoBack()) router.back();
  else if (review) router.replace(stepHref('playbook'));
  else router.push(stepHref(next));
}
