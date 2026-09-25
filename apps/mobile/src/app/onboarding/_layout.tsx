import { Stack, usePathname } from 'expo-router';

import { Gate } from '@/components/Gate';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { ONBOARDING_STEPS, OnboardingStep, stepProgress } from '@/domain/onboarding';
import { goBackFrom, previousStep } from '@/lib/onboardingNav';
import { colors } from '@/theme';

function currentStep(pathname: string): OnboardingStep | null {
  const last = pathname.split('/').filter(Boolean).pop();
  return (ONBOARDING_STEPS as readonly string[]).includes(last ?? '') ? (last as OnboardingStep) : null;
}

export default function OnboardingLayout() {
  const pathname = usePathname();
  const step = currentStep(pathname);
  const canGoBack = step !== null && previousStep(step) !== undefined;

  return (
    <Gate area="onboarding">
      <OnboardingHeader
        progress={step ? stepProgress(step) : 0}
        onBack={canGoBack && step ? () => goBackFrom(step) : undefined}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="analyzing" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="business" options={{ animation: 'fade' }} />
      </Stack>
    </Gate>
  );
}
