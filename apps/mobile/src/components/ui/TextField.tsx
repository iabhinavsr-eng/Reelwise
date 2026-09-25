import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, multiline, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.subtle}
        selectionColor={colors.accent}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          !!error && styles.invalid,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger" style={styles.helper} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg + 2 },
  label: { marginBottom: 7 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    backgroundColor: colors.inputFill,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.ink,
    // Web preview only: our green border is the focus indicator.
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  multiline: { minHeight: 140, paddingTop: 14, lineHeight: 23 },
  focused: { borderColor: colors.accent, backgroundColor: colors.white },
  invalid: { borderColor: colors.danger },
  helper: { marginTop: 6 },
});
