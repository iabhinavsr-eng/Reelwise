import type { User } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';
import { AppError, isNetworkError } from '@/lib/errors';
import type { AuthService, AuthUser, SignUpInput, SignUpResult } from './AuthService';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.full_name as string | undefined) ?? '',
  };
}

function mapError(e: { message?: string } | Error): never {
  const message = (e.message ?? '').toLowerCase();
  if (isNetworkError(e)) throw new AppError('You seem to be offline. Check your connection and try again.', 'network', e);
  if (message.includes('already registered') || message.includes('already exists')) {
    throw new AppError('An account with this email already exists. Try signing in.', 'auth', e);
  }
  if (message.includes('invalid login credentials')) {
    throw new AppError('That email and password don’t match.', 'auth', e);
  }
  if (message.includes('email not confirmed')) {
    throw new AppError('Please confirm your email first — check your inbox.', 'auth', e);
  }
  if (message.includes('password')) throw new AppError(e.message ?? 'Please choose a stronger password.', 'validation', e);
  throw new AppError('We couldn’t sign you in right now. Please try again.', 'unknown', e);
}

export class SupabaseAuthService implements AuthService {
  readonly mode = 'supabase' as const;

  async getCurrentUser() {
    const { data } = await getSupabase().auth.getSession();
    return data.session ? toAuthUser(data.session.user) : null;
  }

  async signUp({ name, email, password }: SignUpInput): Promise<SignUpResult> {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (error) mapError(error);
    return {
      user: data.session && data.user ? toAuthUser(data.user) : null,
      needsEmailConfirmation: !data.session,
    };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) mapError(error);
    return toAuthUser(data.user!);
  }

  async signOut() {
    await getSupabase().auth.signOut();
  }

  async getApiHeaders(): Promise<Record<string, string>> {
    // getSession() refreshes an expired access token when needed.
    const { data } = await getSupabase().auth.getSession();
    return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
  }

  onAuthChange(listener: (user: AuthUser | null) => void) {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      listener(session ? toAuthUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }
}
