import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authService, AuthUser } from '@/services/auth';
import type { SignUpInput, SignUpResult } from '@/services/auth/AuthService';

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  mode: 'supabase' | 'local';
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    authService
      .getCurrentUser()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setInitializing(false));
    const unsubscribe = authService.onAuthChange((u) => setUser(u));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authService.signUp(input);
    if (result.user) setUser(result.user);
    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await authService.signIn(email, password));
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, mode: authService.mode, signUp, signIn, signOut }),
    [user, initializing, signUp, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
