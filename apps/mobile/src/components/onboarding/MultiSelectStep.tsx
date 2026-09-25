import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import type { OnboardingStep } from '@/domain/onboarding';
import { continueTo } from '@/lib/onboardingNav';
import { useAutosave } from '@/lib/useAutosave';
import { useSubmit } from '@/lib/useSubmit';
import { StepScreen } from './StepScreen';

interface Props<T extends string> {
  eyebrow: string;
  title: string;
  subtitle: string;
  options: readonly T[];
  labels: Record<T, string>;
  initial: T[];
  /** What the AI pre-selected, to explain why some chips start selected. */
  suggested?: T[];
  next: OnboardingStep;
  onAutosave: (selected: T[]) => void;
  onConfirm: (selected: T[]) => Promise<void>;
}

export function MultiSelectStep<T extends string>({
  eyebrow,
  title,
  subtitle,
  options,
  labels,
  initial,
  suggested,
  next,
  onAutosave,
  onConfirm,
}: Props<T>) {
  const review = useLocalSearchParams<{ review?: string }>().review === '1';
  const [selected, setSelected] = useState<T[]>(initial);
  const submit = useSubmit();

  useAutosave(selected, onAutosave);

  const toggle = (option: T) =>
    setSelected((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));

  async function onSubmit() {
    // Keep the canonical option order regardless of tap order.
    const ordered = options.filter((o) => selected.includes(o));
    if (await submit.run(() => onConfirm(ordered))) continueTo(next, review);
  }

  const showSuggestedHint = !!suggested?.length && suggested.every((s) => selected.includes(s));

  return (
    <StepScreen
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      ctaTitle={review ? 'Save changes' : 'Continue'}
      onCta={onSubmit}
      ctaDisabled={selected.length === 0}
      ctaLoading={submit.loading}
      error={submit.error}
    >
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip key={option} label={labels[option]} selected={selected.includes(option)} onPress={() => toggle(option)} />
        ))}
      </View>
      <Text variant="caption" tone="muted" style={styles.hint}>
        {selected.length === 0
          ? 'Choose at least one.'
          : showSuggestedHint
            ? 'We pre-selected a few based on your business. Change anything.'
            : `${selected.length} selected`}
      </Text>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hint: { marginTop: 18 },
});
