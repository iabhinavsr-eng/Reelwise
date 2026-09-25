import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdeaCard, IdeaCardSkeleton } from '@/components/ideas/IdeaCard';
import { Button } from '@/components/ui/Button';
import { ErrorNotice } from '@/components/ui/Notice';
import { Text } from '@/components/ui/Text';
import { Wordmark } from '@/components/ui/Wordmark';
import { useAuth } from '@/state/AuthProvider';
import { useIdeas } from '@/state/IdeasProvider';
import { useOnboarding } from '@/state/OnboardingProvider';
import { colors, spacing } from '@/theme';

const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { draft } = useOnboarding();
  const { ideas, status, error, reload, loadMore, loadingMore, exhausted } = useIdeas();
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  const header = (
    <View>
      <View style={styles.topBar}>
        <Wordmark />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          onPress={() => router.push('/profile')}
          hitSlop={8}
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.6 }]}
        >
          <Text variant="label" style={styles.avatarText}>
            {initial}
          </Text>
        </Pressable>
      </View>
      <Text variant="eyebrow" tone="muted" style={styles.date}>
        {today().toUpperCase()}
      </Text>
      <Text variant="display" accessibilityRole="header">
        What should we talk about today?
      </Text>
      <Text variant="supporting" style={styles.subtitle}>
        {draft.business?.name ? `Ideas picked for ${draft.business.name}’s audience.` : 'Ideas picked for your audience.'}
      </Text>
      {status === 'error' ? <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} /> : null}
    </View>
  );

  const footer =
    status !== 'ready' ? null : (
      <View style={styles.footer}>
        {error ? <ErrorNotice message={error} /> : null}
        {exhausted ? (
          <Text variant="caption" tone="muted" center>
            That’s everything for today. New ideas will be waiting tomorrow.
          </Text>
        ) : (
          <Button title="Show me more ideas" variant="secondary" loading={loadingMore} onPress={loadMore} />
        )}
      </View>
    );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxxl }]}
      data={status === 'loading' ? [] : ideas}
      keyExtractor={(idea) => idea.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md + 2 }} />}
      ListEmptyComponent={
        status === 'loading' ? (
          <View style={styles.skeletons} accessibilityLabel="Loading ideas">
            <IdeaCardSkeleton />
            <IdeaCardSkeleton />
          </View>
        ) : status === 'ready' ? (
          <View style={styles.empty}>
            <Text variant="headline" center>
              We’re preparing your next ideas
            </Text>
            <Text variant="callout" tone="muted" center style={{ marginVertical: spacing.sm }}>
              Pull down to refresh, or ask for a fresh batch.
            </Text>
            <Button title="Get ideas" variant="secondary" onPress={loadMore} loading={loadingMore} />
          </View>
        ) : null
      }
      renderItem={({ item }) => <IdeaCard idea={item} onCreate={() => router.push(`/idea/${item.id}`)} />}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.accent} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl - 2 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginBottom: spacing.xl },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accentInk, fontSize: 15 },
  date: { marginBottom: 10 },
  subtitle: { marginTop: 10, marginBottom: spacing.xxl - 4 },
  skeletons: { gap: spacing.md + 2 },
  empty: { paddingVertical: spacing.xxxl, gap: spacing.xs },
  footer: { marginTop: spacing.xxl, gap: spacing.md },
});
