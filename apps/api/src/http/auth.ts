import { createHash } from 'node:crypto';

export interface AuthUser {
  id: string;
  email?: string;
}

export interface Authenticator {
  authenticate(headers: Headers): Promise<AuthUser | null>;
}

/**
 * Verifies a Supabase access token by asking Supabase Auth who it belongs to.
 * Works for both legacy (HS256) and asymmetric-key projects. Results are
 * cached briefly per token so polling doesn't hammer Auth.
 */
export class SupabaseAuthenticator implements Authenticator {
  private readonly cache = new Map<string, { user: AuthUser; expires: number }>();

  constructor(
    private readonly supabaseUrl: string,
    private readonly anonKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!supabaseUrl || !anonKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required when AUTH_MODE=supabase.');
  }

  async authenticate(headers: Headers): Promise<AuthUser | null> {
    const token = headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return null;
    const key = createHash('sha256').update(token).digest('hex');
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;

    const res = await this.fetchImpl(`${this.supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey: this.anonKey },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res?.ok) return null;
    const body = (await res.json()) as { id?: string; email?: string };
    if (!body.id) return null;
    const user = { id: body.id, email: body.email };
    this.cache.set(key, { user, expires: Date.now() + 60_000 });
    if (this.cache.size > 5000) this.cache.clear();
    return user;
  }
}

/**
 * LOCAL DEVELOPMENT ONLY: trusts an `x-dev-user-id` header so the app's demo
 * mode can talk to a local API without Supabase. Refused in production.
 */
export class DevAuthenticator implements Authenticator {
  constructor(isProduction: boolean) {
    if (isProduction) throw new Error('AUTH_MODE=dev is not allowed in production.');
  }

  async authenticate(headers: Headers): Promise<AuthUser | null> {
    const id = headers.get('x-dev-user-id')?.trim();
    return id && /^[\w-]{6,64}$/.test(id) ? { id } : null;
  }
}
