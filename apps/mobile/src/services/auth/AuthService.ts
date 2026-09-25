export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface SignUpResult {
  user: AuthUser | null;
  /** Supabase projects with "Confirm email" on return no session until confirmed. */
  needsEmailConfirmation: boolean;
}

export interface AuthService {
  readonly mode: 'supabase' | 'local';
  getCurrentUser(): Promise<AuthUser | null>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Fires when the session changes outside our own calls (token expiry, etc). */
  onAuthChange(listener: (user: AuthUser | null) => void): () => void;
}
