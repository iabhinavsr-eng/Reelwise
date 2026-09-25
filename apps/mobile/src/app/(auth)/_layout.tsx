import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gate } from '@/components/Gate';
import { Wordmark } from '@/components/ui/Wordmark';
import { colors } from '@/theme';

export default function AuthLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Gate area="auth">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Wordmark />
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </Gate>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', justifyContent: 'center', paddingBottom: 14, backgroundColor: colors.background },
});
