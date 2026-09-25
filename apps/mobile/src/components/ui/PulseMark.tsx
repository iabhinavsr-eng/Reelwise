import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Soft breathing mint halo — calm "we're working" indicator. */
export function PulseMark({ done }: { done?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (done) {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [done, pulse]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
          },
        ]}
      />
      <View style={[styles.core, done && { backgroundColor: colors.accent }]}>
        <Ionicons name={done ? 'checkmark' : 'sparkles'} size={26} color={done ? colors.white : colors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  halo: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accentSoft },
  core: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
  },
});
