import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';

import { colors, type } from '@/theme';

type Variant = keyof typeof type;
type Tone = 'default' | 'muted' | 'accent' | 'danger' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
}

const toneColor: Record<Tone, string> = {
  default: colors.ink,
  muted: colors.muted,
  accent: colors.accent,
  danger: colors.danger,
  inverse: colors.white,
};

export function Text({ variant = 'body', tone, center, style, ...rest }: TextProps) {
  const resolvedTone = tone ?? (variant === 'supporting' ? 'muted' : variant === 'eyebrow' ? 'accent' : 'default');
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      style={[type[variant], { color: toneColor[resolvedTone] }, center && styles.center, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
