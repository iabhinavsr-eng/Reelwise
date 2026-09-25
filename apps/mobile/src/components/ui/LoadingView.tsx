import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/** Full-screen loading or load-failure state. */
export function LoadingView({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text variant="title" center>
            Couldn’t load that
          </Text>
          <Text variant="supporting" center style={styles.message}>
            {error}
          </Text>
          {onRetry ? <Button title="Try again" onPress={onRetry} /> : null}
        </>
      ) : (
        <ActivityIndicator color={colors.accent} size="large" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.background },
  message: { marginTop: spacing.sm, marginBottom: spacing.xxl },
});
