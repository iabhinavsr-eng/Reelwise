/**
 * Client configuration. Only EXPO_PUBLIC_* variables are bundled into the app,
 * so they must never hold secrets. The Supabase anon key is designed to be
 * public (row-level security protects the data). AI / crawling keys live in
 * Supabase Edge Function secrets, never here.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

type AnalysisProvider = 'mock' | 'edge';

const analysisProvider: AnalysisProvider =
  process.env.EXPO_PUBLIC_ANALYSIS_PROVIDER === 'edge' ? 'edge' : 'mock';

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  /** Without Supabase credentials the app runs in local demo mode. */
  isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  analysisProvider,
} as const;
