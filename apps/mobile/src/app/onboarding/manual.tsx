import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { StepScreen } from '@/components/onboarding/StepScreen';
import { TextField } from '@/components/ui/TextField';
import { haptics } from '@/lib/haptics';
import { stepHref } from '@/lib/onboardingNav';
import { useAutosave } from '@/lib/useAutosave';
import type { ManualBusinessInput } from '@/services/analysis';
import { useOnboarding } from '@/state/OnboardingProvider';

/**
 * Fallback when the website couldn't tell us enough. Four short questions;
 * the AI turns the answers into the same profile the website analysis would.
 */
export default function ManualScreen() {
  const { draft, saveLocal } = useOnboarding();
  const [answers, setAnswers] = useState<ManualBusinessInput>(
    draft.manualInput ?? { businessName: draft.business?.name ?? '', whatYouDo: '', customers: '', differentiators: '' },
  );
  const [errors, setErrors] = useState<{ businessName?: string; whatYouDo?: string }>({});

  useAutosave(answers, (manualInput) => saveLocal({ manualInput }));

  if (!draft.websiteUrl) return <Redirect href={stepHref('website')} />;

  const set = (key: keyof ManualBusinessInput) => (value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function onSubmit() {
    const next = {
      businessName: answers.businessName.trim() ? undefined : 'Add your business name.',
      whatYouDo: answers.whatYouDo.trim().length >= 3 ? undefined : 'Tell us a little about what you do.',
    };
    setErrors(next);
    if (next.businessName || next.whatYouDo) return haptics.error();
    saveLocal({
      manualInput: {
        businessName: answers.businessName.trim(),
        whatYouDo: answers.whatYouDo.trim(),
        customers: answers.customers?.trim() || undefined,
        differentiators: answers.differentiators?.trim() || undefined,
      },
      pendingAnalysisId: undefined,
    });
    router.replace(stepHref('analyzing'));
  }

  return (
    <StepScreen
      eyebrow="Your business"
      title="Tell us a little about it."
      subtitle="A sentence or two for each is plenty. We’ll turn this into your profile — you’ll review everything next."
      ctaTitle="Build my profile"
      onCta={onSubmit}
    >
      <TextField label="Business name" value={answers.businessName} onChangeText={set('businessName')} error={errors.businessName} autoCapitalize="words" />
      <TextField
        label="What does your business do?"
        value={answers.whatYouDo}
        onChangeText={set('whatYouDo')}
        error={errors.whatYouDo}
        multiline
        placeholder="e.g. We’re a mobile dog groomer — we come to your home in a fully equipped van."
        style={{ minHeight: 110 }}
      />
      <TextField
        label="Who are your customers?"
        value={answers.customers}
        onChangeText={set('customers')}
        multiline
        placeholder="e.g. Busy dog owners in Austin who don’t have time for salon drop-offs."
        style={{ minHeight: 100 }}
      />
      <TextField
        label="What makes you different?"
        value={answers.differentiators}
        onChangeText={set('differentiators')}
        multiline
        placeholder="e.g. One groomer per dog, no cages, same groomer every visit."
        style={{ minHeight: 100 }}
      />
    </StepScreen>
  );
}
