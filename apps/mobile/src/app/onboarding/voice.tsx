import { MultiSelectStep } from '@/components/onboarding/MultiSelectStep';
import { VOICE_LABELS } from '@/domain/labels';
import { approve } from '@/domain/onboarding';
import { VOICE_TRAITS } from '@/domain/types';
import { useOnboarding } from '@/state/OnboardingProvider';

export default function VoiceScreen() {
  const { draft, saveLocal, confirm } = useOnboarding();
  return (
    <MultiSelectStep
      eyebrow="Your voice"
      title="How should you sound?"
      subtitle="Think about how you’d actually speak to a customer, not how a brochure would sound."
      options={VOICE_TRAITS}
      labels={VOICE_LABELS}
      initial={draft.voiceTraits}
      suggested={draft.analysis?.suggestedVoiceTraits}
      next="playbook"
      onAutosave={(voiceTraits) => saveLocal({ voiceTraits })}
      onConfirm={(voiceTraits) => confirm({ voiceTraits, approved: approve(draft, 'voiceTraits') }, 'playbook')}
    />
  );
}
