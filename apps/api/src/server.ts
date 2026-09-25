import { serve } from '@hono/node-server';

import type { AIProvider } from './analysis/providers/AIProvider.js';
import { OpenAIProvider } from './analysis/providers/OpenAIProvider.js';
import { config } from './config.js';
import { SafeFetcher } from './crawler/fetcher.js';
import { createApp } from './http/app.js';
import { Authenticator, DevAuthenticator, SupabaseAuthenticator } from './http/auth.js';
import { AnalysisJobRunner, Logger } from './jobs/AnalysisJobRunner.js';
import type { AnalysisStore } from './store/AnalysisStore.js';
import { MemoryAnalysisStore } from './store/MemoryAnalysisStore.js';
import { PostgresAnalysisStore } from './store/PostgresAnalysisStore.js';

const log: Logger = {
  info: (o, m) => console.log(JSON.stringify({ level: 'info', msg: m, ...o })),
  warn: (o, m) => console.warn(JSON.stringify({ level: 'warn', msg: m, ...o })),
  error: (o, m) => console.error(JSON.stringify({ level: 'error', msg: m, ...o })),
};

const auth: Authenticator =
  config.authMode === 'dev' ? new DevAuthenticator(config.isProduction) : new SupabaseAuthenticator(config.supabaseUrl, config.supabaseAnonKey);

if (config.authMode === 'supabase' && !config.databaseUrl) {
  if (config.isProduction) throw new Error('DATABASE_URL is required in production (AUTH_MODE=supabase).');
  console.warn('DATABASE_URL not set: analyses are kept in memory and will not be linked from the approved profile.');
}

// Dev auth ids aren't real auth.users rows, so dev mode always uses memory.
const store: AnalysisStore =
  config.databaseUrl && config.authMode !== 'dev' ? PostgresAnalysisStore.fromUrl(config.databaseUrl) : new MemoryAnalysisStore();

let ai: AIProvider | null = null;
if (config.ai.provider === 'openai' && config.ai.openaiApiKey) {
  ai = new OpenAIProvider({
    apiKey: config.ai.openaiApiKey,
    model: config.ai.openaiModel,
    baseUrl: config.ai.openaiBaseUrl,
    temperature: config.ai.temperature,
    timeoutMs: config.ai.timeoutMs,
  });
}

const fetcher = new SafeFetcher({ timeoutMs: config.crawl.requestTimeoutMs, maxBytes: config.crawl.maxResponseBytes, retries: 1 });
const runner = new AnalysisJobRunner(
  store,
  { fetcher, ai, crawl: config.crawl },
  { concurrency: config.jobs.concurrency, timeoutMs: config.jobs.timeoutMs },
  log,
);

const app = createApp({
  store,
  runner,
  auth,
  options: { ratePerHour: config.jobs.ratePerHour, debugEndpoints: config.debugEndpoints, corsOrigins: config.corsOrigins, aiConfigured: !!ai },
});

// Anything left mid-flight by a previous process can't resume.
store.failStale(new Date(Date.now() - 60_000)).then((n) => n && log.warn({ count: n }, 'marked interrupted analyses as failed'));

serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  log.info(
    {
      port: info.port,
      authMode: config.authMode,
      store: store instanceof PostgresAnalysisStore ? 'postgres' : 'memory',
      ai: ai ? `${ai.name}:${ai.model}` : 'NOT CONFIGURED (set OPENAI_API_KEY)',
      debugEndpoints: config.debugEndpoints,
    },
    'Reelwise API listening',
  );
});
