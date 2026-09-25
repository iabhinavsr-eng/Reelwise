import { env } from '@/config/env';
import type { AuthService } from './AuthService';
import { LocalAuthService } from './LocalAuthService';
import { SupabaseAuthService } from './SupabaseAuthService';

export type { AuthService, AuthUser } from './AuthService';

export const authService: AuthService = env.isSupabaseConfigured ? new SupabaseAuthService() : new LocalAuthService();
