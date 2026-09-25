import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { StepScreen } from '@/components/onboarding/StepScreen';
import { SuggestionEditor } from '@/components/onboarding/SuggestionEditor';
import { haptics } from '@/lib/haptics';
import { continueTo, stepHref } from '@/lib/onboardingNav';
import { useAutosave } from '@/lib/useAutosave';
import { useSubmit } from '@/lib/useSubmit';
import { useOnboarding } from '@/state/OnboardingProvider';

/** Internally: ICP. Customer-facing: "your audience" / "ideal customer". */
export default function AudienceScreen() {
  const { draft, saveLocal, confirm } = useOnboarding();
  const review = useLocalSearchParams<{ review?: string }>().review === '1';
  const [summary, setSummary] = useState(draft.audience?.summary ?? '');
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmit();
  const structuredAttributes = draft.audience?.structuredAttributes ?? {};

  useAutosave(summary, (s) => saveLocal({ audience: { summary: s, structuredAttributes } }));

  if (!draft.audience) return <Redirect href={stepHref('website')} />;

  async function onSubmit() {
    if (!summary.trim()) {
      haptics.error();
      return setError('Describe who you want to reach — a sentence is plenty.');
    }
    const audience = { summary: summary.trim(), structuredAttributes };
    if (await submit.run(() => confirm({ audience }, 'value'))) continueTo('value', review);
  }

  return (
    <StepScreen
      eyebrow="Your audience"
      title="Who are you talking to?"
      subtitle="We drafted an ideal customer based on your business. Make it sound like the people you actually want more of."
      ctaTitle={review ? 'Save changes' : 'Use this audience'}
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
        suggestion={draft.analysis?.audience.summary}
        error={error}
        accessibilityLabel="Ideal customer description"
      />
    </StepScreen>
  );
}
