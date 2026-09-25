import { Redirect, router } from 'expo-router';

import { PlaybookSummary } from '@/components/PlaybookSummary';
import { StepScreen } from '@/components/onboarding/StepScreen';
import { playbookFromDraft } from '@/domain/onboarding';
import { haptics } from '@/lib/haptics';
import { stepHref } from '@/lib/onboardingNav';
import { useSubmit } from '@/lib/useSubmit';
import { useOnboarding } from '@/state/OnboardingProvider';

export default function PlaybookScreen() {
  const { draft, confirm } = useOnboarding();
  const submit = useSubmit();
  const playbook = playbookFromDraft(draft);

  if (!playbook) return <Redirect href={stepHref('website')} />;

  async function onStart() {
    // Once saved, the onboarding gate sends the user to their ideas.
    if (await submit.run(() => confirm({}, 'complete'))) haptics.success();
  }

  return (
    <StepScreen
      eyebrow="Final review"
      title="Your Content Playbook"
      subtitle="We’ll use this profile every time we recommend a reel or write a script."
      ctaTitle="Start creating"
      onCta={onStart}
      ctaLoading={submit.loading}
      error={submit.error}
    >
      <PlaybookSummary
        playbook={playbook}
        onEdit={(step) => router.push({ pathname: stepHref(step), params: { review: '1' } })}
      />
    </StepScreen>
  );
}
