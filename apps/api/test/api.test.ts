import { describe, expect, it } from 'vitest';

import type { AIProvider } from '../src/analysis/providers/AIProvider.js';
import { createApp } from '../src/http/app.js';
import { DevAuthenticator } from '../src/http/auth.js';
import { AnalysisJobRunner } from '../src/jobs/AnalysisJobRunner.js';
import { MemoryAnalysisStore } from '../src/store/MemoryAnalysisStore.js';
import { FixtureFetcher } from './fixtures/FixtureFetcher.js';
import { forbidden, wellness } from './fixtures/sites.js';
import { wellnessAI } from './fixtures/stubAI.js';

const silent = { info() {}, warn() {}, error() {} };

function setup(opts: { ratePerHour?: number; ai?: AIProvider | null; debugEndpoints?: boolean } = {}) {
  const store = new MemoryAnalysisStore();
  const runner = new AnalysisJobRunner(
    store,
    { fetcher: new FixtureFetcher(wellness, forbidden), ai: opts.ai === undefined ? wellnessAI() : opts.ai, crawl: { maxPages: 15, maxDepth: 2, concurrency: 4, totalBudgetMs: 10_000 } },
    { concurrency: 2, timeoutMs: 20_000 },
    silent,
  );
  const app = createApp({
    store,
    runner,
    auth: new DevAuthenticator(false),
    options: { ratePerHour: opts.ratePerHour ?? 20, debugEndpoints: opts.debugEndpoints ?? true, corsOrigins: [], aiConfigured: true },
  });
  const call = (method: string, path: string, user: string | null, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { 'x-dev-user-id': user } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  return { store, runner, call };
}

describe('POST /business/analyze → GET /business/analysis/:id', () => {
  it('runs a job to completion and returns the structured analysis', async () => {
    const { call, runner } = setup();
    const res = await call('POST', '/business/analyze', 'user-aaa', { url: 'lyteguards.com' });
    expect(res.status).toBe(202);
    const job = await res.json();
    expect(job).toMatchObject({ status: 'queued', version: 1, mode: 'website', url: 'https://lyteguards.com/' });
    expect(job.jobId).toBe(job.id);

    await runner.idle();
    const done = await (await call('GET', `/business/analysis/${job.jobId}`, 'user-aaa')).json();
    expect(done.status).toBe('completed');
    expect(done.result.business.name.value).toBe('Lyte Guards Mobile IV');
    expect(done.result.evidence.length).toBeGreaterThan(0);
    expect(done).not.toHaveProperty('debug'); // debug is never in the normal response
  });

  it('requires authentication', async () => {
    const { call } = setup();
    expect((await call('POST', '/business/analyze', null, { url: 'lyteguards.com' })).status).toBe(401);
  });

  it('hides other users’ analyses', async () => {
    const { call } = setup();
    const job = await (await call('POST', '/business/analyze', 'user-aaa', { url: 'lyteguards.com' })).json();
    expect((await call('GET', `/business/analysis/${job.jobId}`, 'user-bbb')).status).toBe(404);
    expect((await call('GET', `/business/analysis/${job.jobId}/debug`, 'user-bbb')).status).toBe(404);
  });

  it.each([
    ['not a url', 'invalid_url'],
    ['http://169.254.169.254/latest/meta-data', 'unsafe_url'],
    ['http://localhost:5432', 'unsafe_url'],
    ['http://10.0.0.1', 'unsafe_url'],
  ])('rejects %s with %s before queueing anything', async (url, code) => {
    const { call, store } = setup();
    const res = await call('POST', '/business/analyze', 'user-aaa', { url });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(code);
    expect(await store.countSince('user-aaa', new Date(0))).toBe(0);
  });

  it('rate-limits per user', async () => {
    const { call } = setup({ ratePerHour: 2 });
    for (let i = 0; i < 2; i++) expect((await call('POST', '/business/analyze', 'user-aaa', { url: 'lyteguards.com' })).status).toBe(202);
    expect((await call('POST', '/business/analyze', 'user-aaa', { url: 'lyteguards.com' })).status).toBe(429);
    expect((await call('POST', '/business/analyze', 'user-ccc', { url: 'lyteguards.com' })).status).toBe(202);
  });

  it('re-analysis creates a new version and leaves the previous one intact', async () => {
    const { call, runner } = setup();
    const v1 = await (await call('POST', '/business/analyze', 'user-aaa', { url: 'https://www.lyteguards.com' })).json();
    await runner.idle();
    const v2 = await (await call('POST', '/business/analyze', 'user-aaa', { url: 'https://www.lyteguards.com/' })).json();
    await runner.idle();
    expect(v2.version).toBe(2);
    const first = await (await call('GET', `/business/analysis/${v1.jobId}`, 'user-aaa')).json();
    expect(first.status).toBe('completed');
    expect(first.version).toBe(1);
    expect(first.result.analysisId).toBe(v1.jobId);
  });

  it('reports failures with a code the app can act on', async () => {
    const { call, runner } = setup();
    const blocked = await (await call('POST', '/business/analyze', 'user-aaa', { url: 'cloudwalled.com' })).json();
    await runner.idle();
    const res = await (await call('GET', `/business/analysis/${blocked.jobId}`, 'user-aaa')).json();
    expect(res.status).toBe('failed');
    expect(res.error.code).toBe('crawl_blocked');
    expect(res.result).toBeNull();
  });

  it('reports ai_not_configured when the server has no AI key', async () => {
    const { call, runner } = setup({ ai: null });
    const job = await (await call('POST', '/business/analyze', 'user-aaa', { url: 'lyteguards.com' })).json();
    await runner.idle();
    expect((await (await call('GET', `/business/analysis/${job.jobId}`, 'user-aaa')).json()).error.code).toBe('ai_not_configured');
  });

  it('accepts manual answers for the fallback flow', async () => {
    const { call } = setup();
    const res = await call('POST', '/business/analyze', 'user-aaa', {
      url: 'lyteguards.com',
      manual: { businessName: 'Lyte Guards', whatYouDo: 'Mobile IV therapy', customers: 'Busy people' },
    });
    expect(res.status).toBe(202);
    expect((await res.json()).mode).toBe('manual');
  });
});

describe('GET /business/analysis/:id/debug', () => {
  it('exposes crawled pages, extracted text, facts, rejected claims and timings to the owner', async () => {
    const { call, runner } = setup();
    const job = await (await call('POST', '/business/analyze', 'user-aaa', { url: 'lyteguards.com' })).json();
    await runner.idle();
    const dbg = await (await call('GET', `/business/analysis/${job.jobId}/debug`, 'user-aaa')).json();
    expect(dbg.pages.length).toBeGreaterThan(4);
    expect(dbg.pages[0]).toHaveProperty('content');
    expect(dbg.debug.rejectedClaims.length).toBeGreaterThan(0);
    expect(dbg.debug.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(dbg.job.result.evidence.length).toBeGreaterThan(0);
  });

  it('is disabled when DEBUG_ENDPOINTS is off', async () => {
    const { call, runner } = setup({ debugEndpoints: false });
    const job = await (await call('POST', '/business/analyze', 'user-aaa', { url: 'lyteguards.com' })).json();
    await runner.idle();
    expect((await call('GET', `/business/analysis/${job.jobId}/debug`, 'user-aaa')).status).toBe(404);
  });
});
