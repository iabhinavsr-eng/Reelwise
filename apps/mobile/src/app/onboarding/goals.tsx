import { MultiSelectStep } from '@/components/onboarding/MultiSelectStep';
import { GOAL_LABELS } from '@/domain/labels';
import { CONTENT_GOALS } from '@/domain/types';
import { useOnboarding } from '@/state/OnboardingProvider';

export default function GoalsScreen() {
  const { draft, saveLocal, confirm } = useOnboarding();
  return (
    <MultiSelectStep
      eyebrow="Content goals"
      title="What should your content do?"
      subtitle="Choose what matters most. This changes the ideas we recommend."
      options={CONTENT_GOALS}
      labels={GOAL_LABELS}
      initial={draft.goals}
      suggested={draft.analysis?.suggestedGoals}
      next="voice"
      onAutosave={(goals) => saveLocal({ goals })}
      onConfirm={(goals) => confirm({ goals }, 'voice')}
    />
  );
}
