import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/** Mint callout for helpful context and AI suggestions. */
export function Notice({ children, icon = 'sparkles' }: { children: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={16} color={colors.accentMutedInk} />
      <Text variant="caption" style={styles.noticeText}>
        {children}
      </Text>
    </View>
  );
}

/** Inline, recoverable error with optional retry. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle" size={18} color={colors.danger} />
        <Text variant="caption" style={styles.errorText}>
          {message}
        </Text>
      </View>
      {onRetry ? <Button title="Try again" variant="secondary" compact onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  noticeText: { flex: 1, color: colors.accentMutedInk, fontWeight: '500' },
  error: {
    gap: spacing.md,
    padding: 14,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  errorRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  errorText: { flex: 1, color: colors.danger, fontSize: 14, lineHeight: 19 },
});
