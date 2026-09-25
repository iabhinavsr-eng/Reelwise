import { Stack } from 'expo-router';

import { Gate } from '@/components/Gate';
import { IdeasProvider } from '@/state/IdeasProvider';
import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Gate area="app">
      <IdeasProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
          <Stack.Screen name="idea/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        </Stack>
      </IdeasProvider>
    </Gate>
  );
}
