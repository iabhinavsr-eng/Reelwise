import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { CONTENT_TYPE_LABELS } from '@/domain/labels';
import type { ContentIdea } from '@/domain/types';
import { colors, spacing } from '@/theme';

export function IdeaCard({ idea, onCreate }: { idea: ContentIdea; onCreate: () => void }) {
  const started = idea.status !== 'suggested';
  return (
    <Card elevated style={styles.card}>
      <View style={styles.meta}>
        <Text variant="eyebrow" style={styles.type}>
          {CONTENT_TYPE_LABELS[idea.contentType].toUpperCase()}
        </Text>
        {idea.targetLengthSeconds ? (
          <View style={styles.length}>
            <Ionicons name="time-outline" size={13} color={colors.muted} />
            <Text variant="caption" tone="muted">
              {idea.targetLengthSeconds}s
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="title" style={styles.title}>
        {idea.title}
      </Text>
      <Text variant="callout" tone="muted" style={styles.description}>
        {idea.description}
      </Text>
      <Button
        title={started ? 'Continue this reel' : 'Create this reel'}
        variant={started ? 'secondary' : 'primary'}
        compact
        onPress={onCreate}
      />
    </Card>
  );
}

export function IdeaCardSkeleton() {
  return (
    <Card style={styles.card}>
      <View style={[styles.bone, { width: 90, height: 12 }]} />
      <View style={[styles.bone, { width: '80%', height: 22, marginTop: 14 }]} />
      <View style={[styles.bone, { width: '95%', height: 14, marginTop: 14 }]} />
      <View style={[styles.bone, { width: '60%', height: 14, marginTop: 8 }]} />
      <View style={[styles.bone, { height: 48, marginTop: 20, borderRadius: 15 }]} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  type: { fontSize: 11 },
  length: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { marginTop: 8 },
  description: { marginTop: 6, marginBottom: spacing.lg + 2 },
  bone: { backgroundColor: colors.track, borderRadius: 6 },
});
