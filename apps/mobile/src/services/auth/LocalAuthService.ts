import { AppError } from '@/lib/errors';
import { delay, makeId, readJson, removeKey, writeJson } from '@/lib/storage';
import type { AuthService, AuthUser, SignUpInput } from './AuthService';

/**
 * DEMO-ONLY auth used when Supabase isn't configured, so the full flow runs
 * with zero setup. Accounts live on this device only. The password check is a
 * convenience, not security — never ship this mode to real users.
 */
const ACCOUNTS_KEY = 'reelwise.local.accounts';
const SESSION_KEY = 'reelwise.local.session';

interface LocalAccount extends AuthUser {
  passwordDigest: string;
}

function digest(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export class LocalAuthService implements AuthService {
  readonly mode = 'local' as const;

  private async accounts() {
    return (await readJson<Record<string, LocalAccount>>(ACCOUNTS_KEY)) ?? {};
  }

  async getCurrentUser() {
    const userId = await readJson<string>(SESSION_KEY);
    if (!userId) return null;
    const account = Object.values(await this.accounts()).find((a) => a.id === userId);
    return account ? { id: account.id, email: account.email, name: account.name } : null;
  }

  async signUp({ name, email, password }: SignUpInput) {
    await delay(600); // feel like a network call so loading states are exercised
    const key = email.trim().toLowerCase();
    const accounts = await this.accounts();
    if (accounts[key]) throw new AppError('An account with this email already exists. Try signing in.', 'auth');
    const account: LocalAccount = { id: makeId(), email: key, name: name.trim(), passwordDigest: digest(password) };
    await writeJson(ACCOUNTS_KEY, { ...accounts, [key]: account });
    await writeJson(SESSION_KEY, account.id);
    return { user: { id: account.id, email: account.email, name: account.name }, needsEmailConfirmation: false };
  }

  async signIn(email: string, password: string) {
    await delay(500);
    const account = (await this.accounts())[email.trim().toLowerCase()];
    if (!account || account.passwordDigest !== digest(password)) {
      throw new AppError('That email and password don’t match.', 'auth');
    }
    await writeJson(SESSION_KEY, account.id);
    return { id: account.id, email: account.email, name: account.name };
  }

  async signOut() {
    await removeKey(SESSION_KEY);
  }

  /** Demo mode only: identifies the local user to an API running with AUTH_MODE=dev. */
  async getApiHeaders(): Promise<Record<string, string>> {
    const userId = await readJson<string>(SESSION_KEY);
    return userId ? { 'x-dev-user-id': userId } : {};
  }

  onAuthChange() {
    return () => {};
  }
}
