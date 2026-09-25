import { Text } from 'react-native';

import { colors } from '@/theme';

/** Placeholder text wordmark: "reel" in ink, "wise" in green. */
export function Wordmark({ size = 17 }: { size?: number }) {
  return (
    <Text accessibilityRole="header" accessibilityLabel="Reelwise" style={{ fontSize: size, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 }}>
      reel<Text style={{ color: colors.accent }}>wise</Text>
    </Text>
  );
}
