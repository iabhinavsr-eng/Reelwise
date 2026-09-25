import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { ANALYSIS_STAGES, AnalysisStage } from '@/services/analysis';
import { colors } from '@/theme';

export const STAGE_LABELS: Record<AnalysisStage, string> = {
  reading: 'Reading your website',
  services: 'Understanding your services',
  positioning: 'Learning your positioning',
  audience: 'Building your audience',
  value: 'Drafting your value proposition',
};

function Row({ stage, state }: { stage: AnalysisStage; state: 'done' | 'active' | 'pending' }) {
  const opacity = useRef(new Animated.Value(state === 'pending' ? 0.4 : 1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: state === 'pending' ? 0.4 : 1, duration: 250, useNativeDriver: true }).start();
    if (state === 'done') {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }, [state, opacity, scale]);

  return (
    <Animated.View style={[styles.row, { opacity }]} accessible accessibilityLabel={`${STAGE_LABELS[stage]}: ${state}`}>
      <View style={styles.icon}>
        {state === 'done' ? (
          <Animated.View style={[styles.check, { transform: [{ scale }] }]}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </Animated.View>
        ) : state === 'active' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <View style={styles.dot} />
        )}
      </View>
      <Text variant="callout" style={state === 'done' ? styles.doneLabel : undefined} tone={state === 'pending' ? 'muted' : 'default'}>
        {STAGE_LABELS[stage]}
      </Text>
    </Animated.View>
  );
}

export function AnalysisChecklist({ completed, running }: { completed: AnalysisStage[]; running: boolean }) {
  const activeIndex = running ? completed.length : -1;
  return (
    <View style={styles.list}>
      {ANALYSIS_STAGES.map((stage, i) => (
        <Row
          key={stage}
          stage={stage}
          state={completed.includes(stage) ? 'done' : i === activeIndex ? 'active' : 'pending'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 4, alignSelf: 'center', minWidth: 270 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.input },
  doneLabel: { fontWeight: '500' },
});
