import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { CONTENT_TYPE_LABELS, GOAL_LABELS } from '@/domain/labels';
import { useIdeas } from '@/state/IdeasProvider';
import { useOnboarding } from '@/state/OnboardingProvider';
import { colors, radius, spacing } from '@/theme';

/**
 * Phase 1 end of the road: the idea the user picked, and why it fits.
 * The teleprompter script + recording flow plugs in here next.
 */
export default function IdeaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { ideas, setIdeaStatus } = useIdeas();
  const { draft } = useOnboarding();
  const idea = ideas.find((i) => i.id === id);

  useEffect(() => {
    if (idea?.status === 'suggested') setIdeaStatus(idea.id, 'selected');
  }, [idea, setIdeaStatus]);

  if (!idea) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text variant="headline">This idea is no longer available.</Text>
        <Button title="Back to ideas" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const rows = [
    { icon: 'people-outline' as const, label: 'Speaks to', value: draft.audience?.summary },
    { icon: 'flag-outline' as const, label: 'Goal', value: idea.objective ? GOAL_LABELS[idea.objective] : undefined },
    { icon: 'time-outline' as const, label: 'Length', value: idea.targetLengthSeconds ? `About ${idea.targetLengthSeconds} seconds` : undefined },
  ].filter((r) => r.value);

  return (
    <View style={styles.container}>
      <View style={styles.grabber} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text variant="eyebrow">{CONTENT_TYPE_LABELS[idea.contentType].toUpperCase()}</Text>
        <Text variant="display" style={styles.title} accessibilityRole="header">
          {idea.title}
        </Text>
        <Text variant="supporting">{idea.description}</Text>

        <Card style={styles.card}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Ionicons name={row.icon} size={18} color={colors.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text variant="label" tone="muted">
                  {row.label}
                </Text>
                <Text variant="callout" numberOfLines={3}>
                  {row.value}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <View style={styles.next}>
          <Ionicons name="document-text-outline" size={20} color={colors.accentMutedInk} />
          <View style={{ flex: 1 }}>
            <Text variant="headline" style={{ color: colors.accentInk }}>
              Your script is next
            </Text>
            <Text variant="caption" style={{ color: colors.accentMutedInk, marginTop: 2 }}>
              Soon we’ll write a natural teleprompter script for this idea in your voice, ready to record.
            </Text>
          </View>
        </View>

        <Button title="Back to ideas" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: colors.input, marginTop: 8 },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { marginTop: 10, marginBottom: 10 },
  card: { marginTop: spacing.xxl, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  next: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.xxl,
  },
});
