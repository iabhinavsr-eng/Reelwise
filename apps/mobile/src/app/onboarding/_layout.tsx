import { router, Stack, usePathname } from 'expo-router';

import { Gate } from '@/components/Gate';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { ONBOARDING_STEPS, OnboardingStep, stepProgress } from '@/domain/onboarding';
import { goBackFrom, previousStep, stepHref } from '@/lib/onboardingNav';
import { colors } from '@/theme';

function currentStep(pathname: string): OnboardingStep | null {
  const last = pathname.split('/').filter(Boolean).pop();
  return (ONBOARDING_STEPS as readonly string[]).includes(last ?? '') ? (last as OnboardingStep) : null;
}

export default function OnboardingLayout() {
  const pathname = usePathname();
  const isManual = pathname.endsWith('/manual');
  const step = isManual ? 'analyzing' : currentStep(pathname);
  const canGoBack = isManual || (step !== null && previousStep(step) !== undefined);
  const onBack = isManual ? () => router.replace(stepHref('website')) : step ? () => goBackFrom(step) : undefined;

  return (
    <Gate area="onboarding">
      <OnboardingHeader
        progress={step ? stepProgress(step) : 0}
        onBack={canGoBack ? onBack : undefined}
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
        <Stack.Screen name="manual" options={{ animation: 'fade' }} />
      </Stack>
    </Gate>
  );
}
