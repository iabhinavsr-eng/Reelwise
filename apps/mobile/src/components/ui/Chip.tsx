import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { haptics } from '@/lib/haptics';
import { colors, radius } from '@/theme';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows a trailing × (used for removable service tags). */
  onRemove?: () => void;
}

export function Chip({ label, selected, onPress, onRemove }: ChipProps) {
  const removable = !!onRemove;
  return (
    <Pressable
      accessibilityRole={removable ? 'button' : 'checkbox'}
      accessibilityState={removable ? undefined : { checked: !!selected }}
      accessibilityLabel={removable ? `Remove ${label}` : label}
      hitSlop={4}
      onPress={() => {
        haptics.select();
        (onRemove ?? onPress)?.();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      {selected && !removable ? <Ionicons name="checkmark" size={16} color={colors.accentInk} /> : null}
      <Text variant="callout" style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
      {removable ? <Ionicons name="close" size={16} color={colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoftBorder },
  pressed: { opacity: 0.7 },
  label: { color: colors.ink },
  selectedLabel: { color: colors.accentInk, fontWeight: '600' },
});
