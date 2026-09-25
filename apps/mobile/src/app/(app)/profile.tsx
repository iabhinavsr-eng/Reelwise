import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaybookSummary } from '@/components/PlaybookSummary';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { playbookFromDraft } from '@/domain/onboarding';
import { useAuth } from '@/state/AuthProvider';
import { useOnboarding } from '@/state/OnboardingProvider';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { draft } = useOnboarding();
  const playbook = playbookFromDraft(draft);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.grabber} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text variant="eyebrow">{user?.email?.toUpperCase()}</Text>
        <Text variant="display" style={styles.title} accessibilityRole="header">
          Your Content Playbook
        </Text>
        <Text variant="supporting" style={styles.subtitle}>
          Every idea and script is built from this profile.
        </Text>
        {playbook ? <PlaybookSummary playbook={playbook} /> : null}
        <View style={styles.actions}>
          <Button title="Done" onPress={() => router.back()} />
          <Button
            title="Sign out"
            variant="ghost"
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              await signOut();
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: colors.input, marginTop: 8 },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { marginTop: 10, marginBottom: 10 },
  subtitle: { marginBottom: spacing.xxl - 4 },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },
});
