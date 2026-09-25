import { useAuth } from '@/state/AuthProvider';
import { useOnboarding } from '@/state/OnboardingProvider';

export type Destination = 'loading' | 'error' | 'auth' | 'onboarding' | 'app';

/**
 * Where the user belongs right now. Each route group's layout redirects
 * elsewhere when this doesn't match it, so there's one routing rule.
 */
export function useGate(): Destination {
  const { user, initializing } = useAuth();
  const { ready, loadError, draft } = useOnboarding();
  if (initializing) return 'loading';
  if (!user) return 'auth';
  if (loadError) return 'error';
  if (!ready) return 'loading';
  return draft.completed ? 'app' : 'onboarding';
}

export const DESTINATION_HREF = {
  auth: '/sign-up',
  onboarding: '/onboarding',
  app: '/',
} as const;
