import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ServicesEditor } from '@/components/onboarding/ServicesEditor';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { Notice } from '@/components/ui/Notice';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { env } from '@/config/env';
import { approve, businessDiffersFromSuggestion } from '@/domain/onboarding';
import type { BusinessProfile } from '@/domain/types';
import { displayHost } from '@/domain/validation';
import { haptics } from '@/lib/haptics';
import { continueTo, stepHref } from '@/lib/onboardingNav';
import { useAutosave } from '@/lib/useAutosave';
import { useSubmit } from '@/lib/useSubmit';
import { useOnboarding } from '@/state/OnboardingProvider';

export default function BusinessScreen() {
  const { draft, saveLocal, confirm } = useOnboarding();
  const review = useLocalSearchParams<{ review?: string }>().review === '1';
  const [profile, setProfile] = useState<BusinessProfile | undefined>(draft.business);
  const [errors, setErrors] = useState<{ name?: string; industry?: string }>({});
  const submit = useSubmit();

  useAutosave(profile, (business) => business && saveLocal({ business }));

  if (!profile) return <Redirect href={stepHref('website')} />;

  const set = <K extends keyof BusinessProfile>(key: K) => (value: BusinessProfile[K]) => {
    setProfile({ ...profile, [key]: value });
    if (key in errors) setErrors({ ...errors, [key]: undefined });
  };

  async function onSubmit() {
    if (!profile) return;
    const next = {
      name: profile.name.trim() ? undefined : 'Add your business name.',
      industry: profile.industry.trim() ? undefined : 'Add your industry.',
    };
    setErrors(next);
    if (next.name || next.industry) return haptics.error();
    const trimmed = { ...profile, name: profile.name.trim(), industry: profile.industry.trim() };
    if (await submit.run(() => confirm({ business: trimmed, approved: approve(draft, 'business') }, 'audience'))) continueTo('audience', review);
  }

  return (
    <StepScreen
      eyebrow="Business profile"
      title="Did we get this right?"
      subtitle="Edit anything that doesn’t accurately describe the business."
      ctaTitle={review ? 'Save changes' : 'Looks right'}
      onCta={onSubmit}
      ctaLoading={submit.loading}
      error={submit.error}
    >
      {draft.approved?.business && businessDiffersFromSuggestion({ ...draft, business: profile }) ? (
        <Notice icon="refresh" action={{ label: 'Use them', onPress: () => draft.analysis && setProfile(draft.analysis.business) }}>
          {`We found updated details on ${displayHost(profile.websiteUrl)}. You’re seeing your saved version.`}
        </Notice>
      ) : (
        <Notice>{draft.analysis?.details?.mode === 'manual' ? 'Drafted from your answers' : `Drafted from ${displayHost(profile.websiteUrl)}`}</Notice>
      )}
      <TextField label="Business name" value={profile.name} onChangeText={set('name')} error={errors.name} autoCapitalize="words" />
      <TextField label="Industry" value={profile.industry} onChangeText={set('industry')} error={errors.industry} />
      <TextField
        label="Primary location"
        value={profile.primaryLocation}
        onChangeText={set('primaryLocation')}
        placeholder="City, State"
        textContentType="addressCityAndState"
      />
      <TextField
        label="What the business does"
        value={profile.description}
        onChangeText={set('description')}
        multiline
        style={{ minHeight: 120 }}
      />
      <ServicesEditor services={profile.services} onChange={set('services')} />
      {env.debugToolsEnabled && draft.analysis ? (
        <Text
          variant="caption"
          tone="accent"
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/debug/analysis', params: { id: draft.analysis?.analysisId ?? 'local' } })}
          style={{ paddingVertical: 12 }}
        >
          Developer: inspect this analysis →
        </Text>
      ) : null}
    </StepScreen>
  );
}
