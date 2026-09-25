import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/ui/Wordmark';
import { colors, touchTarget } from '@/theme';

interface Props {
  progress: number; // 0–1
  onBack?: () => void;
}

/** Back chevron, wordmark and a thin green progress bar that animates between steps. */
export function OnboardingHeader({ progress, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const width = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: progress,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, width]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}
            >
              <Ionicons name="chevron-back" size={26} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <Wordmark />
        <View style={styles.side} />
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <Animated.View
          style={[styles.bar, { width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  row: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  side: { width: touchTarget },
  back: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, backgroundColor: colors.track },
  bar: { height: 4, backgroundColor: colors.accent, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});
