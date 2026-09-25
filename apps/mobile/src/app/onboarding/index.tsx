import { Redirect } from 'expo-router';

import { stepHref } from '@/lib/onboardingNav';
import { useOnboarding } from '@/state/OnboardingProvider';

/** Resume onboarding exactly where the user left off. */
export default function OnboardingIndex() {
  const { draft } = useOnboarding();
  let step = draft.step;
  // Analysis can't resume mid-flight: re-run it, or skip ahead if it finished.
  if (step === 'analyzing') step = draft.analysis ? 'business' : draft.websiteUrl ? 'analyzing' : 'website';
  return <Redirect href={stepHref(step)} />;
}
