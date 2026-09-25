import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorNotice } from '@/components/ui/Notice';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme';

export interface StepScreenProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  ctaTitle: string;
  onCta: () => void;
  ctaLoading?: boolean;
  ctaDisabled?: boolean;
  /** Shown above the CTA (e.g. a failed save with retry). */
  error?: string | null;
  /** Rendered under the CTA (e.g. "Already have an account?"). */
  footer?: ReactNode;
}

/**
 * Standard one-decision-per-screen layout: eyebrow, headline, supporting copy,
 * content, and a pinned primary action that stays above the keyboard.
 */
export function StepScreen({
  eyebrow,
  title,
  subtitle,
  children,
  ctaTitle,
  onCta,
  ctaLoading,
  ctaDisabled,
  error,
  footer,
}: StepScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {eyebrow ? (
          <Text variant="eyebrow" style={styles.eyebrow}>
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="supporting" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.lg) + 4 }]}>
        {error ? <ErrorNotice message={error} /> : null}
        <Button title={ctaTitle} onPress={onCta} loading={ctaLoading} disabled={ctaDisabled} />
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  eyebrow: { marginBottom: 11 },
  title: { marginBottom: 11 },
  subtitle: { marginBottom: spacing.xxl - 2 },
  bottom: {
    paddingHorizontal: spacing.xl - 2,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
