import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { spacing } from '@/theme';

/** Services as removable tags plus an "add" field. */
export function ServicesEditor({ services, onChange }: { services: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function add() {
    const value = draft.trim();
    if (!value) return;
    if (!services.some((s) => s.toLowerCase() === value.toLowerCase())) onChange([...services, value]);
    setDraft('');
  }

  return (
    <View>
      <Text variant="label" style={styles.label}>
        Services
      </Text>
      {services.length ? (
        <View style={styles.chips}>
          {services.map((service) => (
            <Chip key={service} label={service} onRemove={() => onChange(services.filter((s) => s !== service))} />
          ))}
        </View>
      ) : (
        <Text variant="caption" tone="muted" style={styles.empty}>
          Add the main things you offer.
        </Text>
      )}
      <TextField
        placeholder="Add a service"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        onBlur={add}
        returnKeyType="done"
        submitBehavior="submit"
        accessibilityLabel="Add a service"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  empty: { marginBottom: spacing.md },
});
