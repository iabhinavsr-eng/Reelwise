import { Redirect } from 'expo-router';
import { ReactNode } from 'react';

import { LoadingView } from '@/components/ui/LoadingView';
import { Destination, DESTINATION_HREF, useGate } from '@/lib/useGate';
import { useOnboarding } from '@/state/OnboardingProvider';

/** Renders children only when the user belongs in this area; otherwise redirects. */
export function Gate({ area, children }: { area: Exclude<Destination, 'loading' | 'error'>; children: ReactNode }) {
  const destination = useGate();
  const { loadError, retryLoad } = useOnboarding();
  if (destination === 'loading') return <LoadingView />;
  if (destination === 'error') return <LoadingView error={loadError} onRetry={retryLoad} />;
  if (destination !== area) return <Redirect href={DESTINATION_HREF[destination]} />;
  return <>{children}</>;
}
