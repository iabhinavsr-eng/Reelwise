import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { colors, radius, touchTarget } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  compact?: boolean;
}

export function Button({ title, variant = 'primary', loading, disabled, icon, compact, onPress, ...rest }: ButtonProps) {
  const inactive = disabled || loading;
  const fg = variant === 'primary' ? colors.white : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={title}
      disabled={inactive}
      onPress={(e) => {
        haptics.tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        variant === 'primary' && { backgroundColor: pressed ? colors.inkPressed : colors.ink },
        variant === 'secondary' && [styles.secondary, pressed && { backgroundColor: colors.surface }],
        variant === 'ghost' && pressed && { backgroundColor: colors.surface },
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="headline" style={{ color: fg, fontWeight: variant === 'ghost' ? '600' : '700' }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  compact: { minHeight: touchTarget, paddingHorizontal: 16 },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.35 },
  pressed: { transform: [{ scale: 0.99 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
