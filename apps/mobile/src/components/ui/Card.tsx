import { StyleSheet, View, ViewProps } from 'react-native';

import { colors, radius, shadow } from '@/theme';

export function Card({ style, elevated, ...rest }: ViewProps & { elevated?: boolean }) {
  return <View style={[styles.card, elevated && shadow, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg + 3,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
});
