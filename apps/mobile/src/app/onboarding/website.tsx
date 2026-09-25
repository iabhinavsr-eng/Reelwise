import { router } from 'expo-router';
import { useState } from 'react';

import { StepScreen } from '@/components/onboarding/StepScreen';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { furthestStep } from '@/domain/onboarding';
import { normalizeWebsiteUrl, validateWebsiteUrl } from '@/domain/validation';
import { haptics } from '@/lib/haptics';
import { stepHref } from '@/lib/onboardingNav';
import { useOnboarding } from '@/state/OnboardingProvider';

export default function WebsiteScreen() {
  const { draft, saveLocal } = useOnboarding();
  const [url, setUrl] = useState(draft.websiteUrl ?? '');
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    const problem = validateWebsiteUrl(url);
    const normalized = normalizeWebsiteUrl(url);
    if (problem || !normalized) {
      haptics.error();
      setError(problem);
      return;
    }
    // Same site already analyzed? Don't make them wait again.
    if (draft.analysis && draft.analysis.business.websiteUrl === normalized) {
      router.push(stepHref('business'));
      return;
    }
    saveLocal({
      websiteUrl: normalized,
      analysis: undefined,
      pendingAnalysisId: undefined,
      manualInput: undefined,
      step: furthestStep(draft.step, 'analyzing'),
    });
    router.push(stepHref('analyzing'));
  }

  return (
    <StepScreen
      eyebrow="Your business"
      title="What’s your website?"
      subtitle="That’s all we need to get started. We’ll read it and prepare your business profile for you."
      ctaTitle="Analyze my business"
      onCta={onSubmit}
    >
      <TextField
        label="Business URL"
        placeholder="yourbusiness.com"
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          if (error) setError(null);
        }}
        error={error}
        keyboardType="url"
        textContentType="URL"
        autoComplete="url"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Notice icon="eye-outline">You’ll review everything before we use it to create content.</Notice>
    </StepScreen>
  );
}
