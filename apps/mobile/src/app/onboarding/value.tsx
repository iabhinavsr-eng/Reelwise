import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { StepScreen } from '@/components/onboarding/StepScreen';
import { SuggestionEditor } from '@/components/onboarding/SuggestionEditor';
import { haptics } from '@/lib/haptics';
import { continueTo, stepHref } from '@/lib/onboardingNav';
import { useAutosave } from '@/lib/useAutosave';
import { useSubmit } from '@/lib/useSubmit';
import { useOnboarding } from '@/state/OnboardingProvider';

/** Internally: UVP. Customer-facing: "why should they choose you?". */
export default function ValueScreen() {
  const { draft, saveLocal, confirm } = useOnboarding();
  const review = useLocalSearchParams<{ review?: string }>().review === '1';
  const [summary, setSummary] = useState(draft.valueProposition?.summary ?? '');
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmit();

  useAutosave(summary, (s) => saveLocal({ valueProposition: { summary: s } }));

  if (!draft.valueProposition) return <Redirect href={stepHref('website')} />;

  async function onSubmit() {
    if (!summary.trim()) {
      haptics.error();
      return setError('Tell us what makes you different — one or two sentences.');
    }
    if (await submit.run(() => confirm({ valueProposition: { summary: summary.trim() } }, 'goals'))) {
      continueTo('goals', review);
    }
  }

  return (
    <StepScreen
      eyebrow="What makes you different"
      title="Why should they choose you?"
      subtitle="This helps us make your content specific instead of producing generic industry advice."
      ctaTitle={review ? 'Save changes' : 'Use this positioning'}
      onCta={onSubmit}
      ctaLoading={submit.loading}
      error={submit.error}
    >
      <SuggestionEditor
        value={summary}
        onChange={(t) => {
          setSummary(t);
          setError(null);
        }}
        suggestion={draft.analysis?.valueProposition.summary}
        error={error}
        accessibilityLabel="Why customers choose you"
      />
    </StepScreen>
  );
}
