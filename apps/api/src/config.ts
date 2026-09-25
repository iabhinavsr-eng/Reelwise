/**
 * Server configuration, read once from the environment. Secrets (OpenAI key,
 * database URL) live only here — never in the mobile app.
 */
function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: int('PORT', 8787),

  /** 'supabase' verifies Supabase access tokens; 'dev' trusts x-dev-user-id (never in production). */
  authMode: (process.env.AUTH_MODE === 'dev' ? 'dev' : 'supabase') as 'dev' | 'supabase',
  supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, '') ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  /** Direct Postgres connection (Supabase → Project Settings → Database). Empty = in-memory store. */
  databaseUrl: process.env.DATABASE_URL ?? '',

  ai: {
    provider: process.env.AI_PROVIDER ?? 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    openaiBaseUrl: (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    /** Some models only accept the default temperature; leave unset for those. */
    temperature: process.env.OPENAI_TEMPERATURE ? Number(process.env.OPENAI_TEMPERATURE) : undefined,
    timeoutMs: int('AI_TIMEOUT_MS', 90_000),
  },

  crawl: {
    maxPages: int('CRAWL_MAX_PAGES', 15),
    maxDepth: int('CRAWL_MAX_DEPTH', 2),
    requestTimeoutMs: int('CRAWL_REQUEST_TIMEOUT_MS', 10_000),
    totalBudgetMs: int('CRAWL_BUDGET_MS', 45_000),
    maxResponseBytes: int('CRAWL_MAX_RESPONSE_BYTES', 2_000_000),
    concurrency: int('CRAWL_CONCURRENCY', 4),
  },

  jobs: {
    concurrency: int('ANALYSIS_CONCURRENCY', 3),
    timeoutMs: int('ANALYSIS_TIMEOUT_MS', 180_000),
    ratePerHour: int('ANALYSIS_RATE_LIMIT_PER_HOUR', 20),
  },

  /** Debug endpoint (owner-only). Off in production unless explicitly enabled. */
  debugEndpoints: bool('DEBUG_ENDPOINTS', !isProduction),
  corsOrigins: (process.env.CORS_ORIGINS ?? (isProduction ? '' : '*')).split(',').map((s) => s.trim()).filter(Boolean),
};

export type Config = typeof config;
