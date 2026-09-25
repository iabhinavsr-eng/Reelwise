/**
 * Local end-to-end harness: the real HTTP app, job runner, pipeline and
 * verification — with fixture websites instead of the internet and a stub
 * instead of OpenAI. Used to drive the mobile app through the API in CI-like
 * conditions:  npx tsx test/e2e-server.ts  (port 8790)
 */
import { serve } from '@hono/node-server';

import { createApp } from '../src/http/app.js';
import { DevAuthenticator } from '../src/http/auth.js';
import { AnalysisJobRunner } from '../src/jobs/AnalysisJobRunner.js';
import { MemoryAnalysisStore } from '../src/store/MemoryAnalysisStore.js';
import { FixtureFetcher } from './fixtures/FixtureFetcher.js';
import { ecommerce, forbidden, lawFirm, parked, plumber, restaurant, wellness } from './fixtures/sites.js';
import { StubAIProvider, wellnessPositioning, wellnessProfile } from './fixtures/stubAI.js';

const pagesFromPrompt = (user: string) => [...user.matchAll(/<page id="(P\d+)" url="([^"]+)"/g)].map((m) => ({ id: m[1], url: m[2] }));
const slow = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 1200));

const ai = new StubAIProvider({
  business_profile: (req) => {
    if (req.user.includes('url="owner-provided"')) {
      const name = req.user.match(/Business name: (.+)/)?.[1] ?? 'Your business';
      const what = req.user.match(/What the business does: (.+)/)?.[1] ?? '';
      return {
        businessName: { value: name, pageIds: ['P0'], quote: name },
        industry: 'Pet grooming',
        description: what,
        services: [{ value: 'Mobile dog grooming', pageIds: ['P0'], quote: what.split(' ').slice(0, 6).join(' ') }],
        products: [],
        locations: [],
        serviceAreas: [],
        facts: [],
        contentSufficiency: 'limited',
        confidence: { name: 'high', industry: 'medium', services: 'medium', locations: 'low' },
      };
    }
    return wellnessProfile(pagesFromPrompt(req.user));
  },
  business_positioning: () => wellnessPositioning(),
});
// Make progress observable in the UI.
const original = ai.generateStructured.bind(ai);
ai.generateStructured = (async (req: Parameters<typeof original>[0]) => slow(await original(req))) as typeof ai.generateStructured;

const store = new MemoryAnalysisStore();
const runner = new AnalysisJobRunner(
  store,
  { fetcher: new FixtureFetcher(wellness, plumber, lawFirm, ecommerce, restaurant, parked, forbidden), ai, crawl: { maxPages: 15, maxDepth: 2, concurrency: 4, totalBudgetMs: 10_000 } },
  { concurrency: 2, timeoutMs: 30_000 },
  { info: (o, m) => console.log(m, JSON.stringify(o)), warn: (o, m) => console.log(m, JSON.stringify(o)), error: (o, m) => console.error(m, JSON.stringify(o)) },
);
const app = createApp({
  store,
  runner,
  auth: new DevAuthenticator(false),
  options: { ratePerHour: 100, debugEndpoints: true, corsOrigins: ['*'], aiConfigured: true },
});
serve({ fetch: app.fetch, port: 8790 }, () => console.log('e2e API on :8790'));
