import { env } from '@/config/env';
import { LocalProfileRepository } from './LocalProfileRepository';
import type { ProfileRepository } from './ProfileRepository';
import { SupabaseProfileRepository } from './SupabaseProfileRepository';

export type { ProfileRepository } from './ProfileRepository';

export const profileRepository: ProfileRepository = env.isSupabaseConfigured
  ? new SupabaseProfileRepository()
  : new LocalProfileRepository();
