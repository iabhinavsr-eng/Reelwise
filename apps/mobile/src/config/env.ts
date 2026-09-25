/**
 * Client configuration. Only EXPO_PUBLIC_* variables are bundled into the app,
 * so they must never hold secrets. The Supabase anon key is designed to be
 * public (row-level security protects the data). AI / crawling keys live on
 * the Reelwise API server (apps/api), never here.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
/** Reelwise API (apps/api). Empty = on-device mock analysis. */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL?.trim() || '').replace(/\/$/, '');

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  /** Without Supabase credentials the app runs in local demo mode. */
  isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  apiUrl,
  analysisProvider: (apiUrl ? 'api' : 'mock') as 'api' | 'mock',
  /** Developer tools (analysis debug view). Never on for normal users. */
  debugToolsEnabled: __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEBUG_TOOLS === 'true',
} as const;
