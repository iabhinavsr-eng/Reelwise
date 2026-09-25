import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { OnboardingStep } from '@/domain/onboarding';
import { GOAL_LABELS, VOICE_LABELS } from '@/domain/labels';
import type { ContentPlaybook } from '@/domain/types';
import { colors, spacing } from '@/theme';

interface Section {
  key: OnboardingStep;
  label: string;
  title?: string;
  body: string;
}

export function playbookSections(p: ContentPlaybook): Section[] {
  const location = p.business.primaryLocation ? ` · ${p.business.primaryLocation}` : '';
  return [
    { key: 'business', label: 'Business', title: p.business.name, body: `${p.business.industry}${location}` },
    { key: 'audience', label: 'Ideal customer', body: p.audience.summary },
    { key: 'value', label: 'What makes you different', body: p.valueProposition.summary },
    { key: 'goals', label: 'Content goals', body: p.preferences.goals.map((g) => GOAL_LABELS[g]).join(' · ') },
    { key: 'voice', label: 'Voice', body: p.preferences.voiceTraits.map((v) => VOICE_LABELS[v]).join(' · ') },
  ];
}

/** Clean summary cards; pass onEdit to show an Edit action per section. */
export function PlaybookSummary({ playbook, onEdit }: { playbook: ContentPlaybook; onEdit?: (step: OnboardingStep) => void }) {
  return (
    <View style={styles.list}>
      {playbookSections(playbook).map((section) => (
        <Card key={section.key}>
          <View style={styles.header}>
            <Text variant="eyebrow" tone="muted" style={styles.label}>
              {section.label.toUpperCase()}
            </Text>
            {onEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${section.label}`}
                onPress={() => onEdit(section.key)}
                hitSlop={12}
                style={({ pressed }) => [styles.edit, pressed && { opacity: 0.5 }]}
              >
                <Text variant="caption" style={styles.editText}>
                  Edit
                </Text>
              </Pressable>
            ) : null}
          </View>
          {section.title ? (
            <Text variant="headline" style={styles.title}>
              {section.title}
            </Text>
          ) : null}
          <Text variant="callout" tone={section.title ? 'muted' : 'default'}>
            {section.body || '—'}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, marginBottom: 6 },
  label: { fontSize: 11 },
  edit: { minHeight: 32, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  editText: { color: colors.accent, fontWeight: '600' },
  title: { marginBottom: 2 },
});
