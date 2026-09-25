import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { colors, radius, spacing } from '@/theme';

interface Props {
  value: string;
  onChange: (text: string) => void;
  suggestion?: string;
  error?: string | null;
  accessibilityLabel: string;
}

/**
 * "AI suggested" badge + editable text, with a one-tap way back to the
 * original suggestion once the user has edited it.
 */
export function SuggestionEditor({ value, onChange, suggestion, error, accessibilityLabel }: Props) {
  const edited = suggestion !== undefined && value.trim() !== suggestion.trim();
  return (
    <View>
      <View style={styles.header}>
        <View style={[styles.badge, edited && styles.badgeEdited]}>
          <Text variant="eyebrow" style={[styles.badgeText, edited && { color: colors.muted }]}>
            {edited ? 'EDITED BY YOU' : '✦ AI SUGGESTED'}
          </Text>
        </View>
        {edited ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange(suggestion!)}
            hitSlop={10}
            style={({ pressed }) => [styles.reset, pressed && { opacity: 0.5 }]}
          >
            <Text variant="caption" style={styles.resetText}>
              Use suggestion
            </Text>
          </Pressable>
        ) : null}
      </View>
      <TextField
        value={value}
        onChangeText={onChange}
        multiline
        error={error}
        accessibilityLabel={accessibilityLabel}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  badge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  badgeEdited: { backgroundColor: colors.surface },
  badgeText: { color: colors.accentMutedInk, fontSize: 11 },
  reset: { minHeight: 36, justifyContent: 'center' },
  resetText: { color: colors.accent, fontWeight: '600' },
  input: { minHeight: 180, fontSize: 17, lineHeight: 25 },
});
