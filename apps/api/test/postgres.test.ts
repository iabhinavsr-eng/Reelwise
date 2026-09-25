import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AnalysisResult } from '../src/analysis/types.js';
import { PostgresAnalysisStore } from '../src/store/PostgresAnalysisStore.js';

/**
 * Integration tests against a real Postgres with the Supabase migrations
 * applied. Opt-in: set TEST_DATABASE_URL to a DISPOSABLE database whose name
 * contains "test" — the schema is dropped and rebuilt.
 */
const url = process.env.TEST_DATABASE_URL;
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../../supabase/migrations');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function fakeResult(id: string, version: number, summary: string): AnalysisResult {
  return {
    analysisId: id,
    version,
    pipelineVersion: 'test',
    mode: 'website',
    websiteUrl: 'https://biz.com/',
    analyzedAt: new Date().toISOString(),
    business: { name: { value: 'Biz', sources: ['https://biz.com/'] }, website: 'https://biz.com/', industry: 'Plumbing', description: 'Fixes pipes.', locations: [], serviceAreas: [], services: [{ value: 'Drain cleaning', sources: ['https://biz.com/services'] }], products: [] },
    audience: { summary, customerTypes: ['Homeowners'], needs: [], painPoints: [], motivations: [], behaviors: [], locations: [], ageRanges: [] },
    valueProposition: { summary: 'Fast plumbing.', differentiators: [], problemsSolved: [], benefits: [] },
    brandVoice: { suggestedTraits: ['straightforward'], observedTone: null },
    suggestedGoals: ['build_trust'],
    evidence: [{ id: 'F1', category: 'service', statement: 'Offers drain cleaning', quote: 'Drain cleaning', sources: ['https://biz.com/services'] }],
    inferences: [{ id: 'I1', category: 'audience', statement: summary, basedOn: ['F1'] }],
    confidence: { name: 'high', industry: 'high', services: 'high', locations: 'low', audience: 'medium', valueProposition: 'medium' },
  };
}

describe.skipIf(!url)('PostgresAnalysisStore + migrations (integration)', () => {
  let pool: pg.Pool;
  let store: PostgresAnalysisStore;

  beforeAll(async () => {
    if (!/test/.test(new URL(url!).pathname)) throw new Error('TEST_DATABASE_URL must point at a database whose name contains "test".');
    pool = new pg.Pool({ connectionString: url });
    await pool.query('drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;');
    await pool.query(readFileSync(path.join(here, 'fixtures/supabase-stub.sql'), 'utf8'));
    await pool.query(`insert into auth.users (id, email) values ('${USER_A}', 'a@x.com'), ('${USER_B}', 'b@x.com')`);

    const [phase1, ...rest] = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    await pool.query(readFileSync(path.join(migrationsDir, phase1), 'utf8'));
    // A Phase 1 row written by the old client, to prove the Phase 2 backfill works.
    await pool.query(`insert into public.businesses (id, user_id, name, website_url) values ('aaaaaaaa-0000-4000-8000-000000000001', '${USER_A}', 'Old', 'https://old.com')`);
    await pool.query(`insert into public.business_analyses (business_id, website_url, provider, result) values ('aaaaaaaa-0000-4000-8000-000000000001', 'https://old.com', 'mock', '{}')`);
    for (const f of rest) await pool.query(readFileSync(path.join(migrationsDir, f), 'utf8'));
    await pool.query('grant usage on schema public to authenticated; grant select, insert, update, delete on all tables in schema public to authenticated;');
    store = new PostgresAnalysisStore(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('backfills Phase 1 analyses (status succeeded → completed, user_id set)', async () => {
    const { rows } = await pool.query("select status, user_id from public.business_analyses where website_url = 'https://old.com'");
    expect(rows).toEqual([{ status: 'completed', user_id: USER_A }]);
  });

  it('numbers versions per user + site', async () => {
    const a1 = await store.create({ userId: USER_A, inputUrl: 'biz.com', normalizedUrl: 'https://biz.com/', mode: 'website' });
    const a2 = await store.create({ userId: USER_A, inputUrl: 'www.biz.com', normalizedUrl: 'https://biz.com/', mode: 'website' });
    const b1 = await store.create({ userId: USER_B, inputUrl: 'biz.com', normalizedUrl: 'https://biz.com/', mode: 'website' });
    expect([a1.version, a2.version, b1.version]).toEqual([1, 2, 1]);
    expect(a1.status).toBe('queued');
  });

  it('persists progress, crawled pages, and the completed analysis with suggestions, evidence and confidence', async () => {
    const rec = await store.create({ userId: USER_A, inputUrl: 'x.com', normalizedUrl: 'https://x.com/', mode: 'website' });
    await store.updateStatus(rec.id, 'crawling', { progress: { pagesCrawled: 2, pagesPlanned: 8 } });
    expect((await store.get(rec.id))!.progress).toEqual({ pagesCrawled: 2, pagesPlanned: 8 });
    await store.savePages(rec.id, [
      { url: 'https://x.com/', finalUrl: 'https://x.com/', pageType: 'home', depth: 0, priority: 100, statusCode: 200, title: 'X', metaDescription: null, h1: 'X', headings: ['A'], content: 'Hello', structuredData: [], siteName: null, fetchedAt: new Date().toISOString() },
    ]);
    await store.updateStatus(rec.id, 'analyzing', { phase: 'positioning' });
    await store.complete(rec.id, fakeResult(rec.id, rec.version, 'Homeowners in Columbus'), { evidencePages: [], rejectedClaims: [], warnings: [], timings: { totalMs: 5 } }, { pipelineVersion: 'test', model: 'openai:gpt-x' });

    const done = (await store.get(rec.id))!;
    expect(done.status).toBe('completed');
    expect(done.phase).toBeNull();
    expect(done.result?.business.services[0].sources).toEqual(['https://biz.com/services']);
    expect(done.completedAt).not.toBeNull();
    const { rows } = await pool.query('select suggested_audience, facts, confidence, model, pipeline_version from public.business_analyses where id = $1', [rec.id]);
    expect(rows[0].suggested_audience.summary).toBe('Homeowners in Columbus');
    expect(rows[0].facts[0].sources).toEqual(['https://biz.com/services']);
    expect(rows[0].confidence.audience).toBe('medium');
    expect(rows[0].model).toBe('openai:gpt-x');
    expect(await store.getPages(rec.id)).toHaveLength(1);
    // Terminal states can't be overwritten by a late progress update.
    await store.updateStatus(rec.id, 'crawling');
    expect((await store.get(rec.id))!.status).toBe('completed');
  });

  it('re-analysis never touches the user-approved profile', async () => {
    const v1 = await store.create({ userId: USER_A, inputUrl: 'plumb.com', normalizedUrl: 'https://plumb.com/', mode: 'website' });
    await store.complete(v1.id, fakeResult(v1.id, 1, 'AI suggestion v1'), { evidencePages: [], rejectedClaims: [], warnings: [], timings: {} }, { pipelineVersion: 't', model: null });

    // The user approves an EDITED audience (what the app writes on "Use this audience").
    const { rows: biz } = await pool.query(
      `insert into public.businesses (user_id, name, website_url, current_analysis_id, profile_approved_at) values ($1, 'Plumb Co', 'https://plumb.com/', $2, now()) returning id`,
      [USER_A, v1.id],
    );
    await pool.query(
      `insert into public.audience_profiles (business_id, summary, ai_suggested_summary, source_analysis_id, user_edited, approved_at)
       values ($1, 'Landlords with older buildings', 'AI suggestion v1', $2, true, now())`,
      [biz[0].id, v1.id],
    );

    const v2 = await store.create({ userId: USER_A, inputUrl: 'plumb.com', normalizedUrl: 'https://plumb.com/', mode: 'website' });
    await store.complete(v2.id, fakeResult(v2.id, 2, 'AI suggestion v2 — totally different'), { evidencePages: [], rejectedClaims: [], warnings: [], timings: {} }, { pipelineVersion: 't', model: null });

    const { rows: approved } = await pool.query('select summary, user_edited, source_analysis_id from public.audience_profiles where business_id = $1', [biz[0].id]);
    expect(approved[0]).toEqual({ summary: 'Landlords with older buildings', user_edited: true, source_analysis_id: v1.id });
    expect((await store.get(v1.id))!.result!.audience.summary).toBe('AI suggestion v1');
    expect((await store.get(v2.id))!.version).toBe(2);
  });

  it('records failures with code and debug, and fails stale jobs', async () => {
    const rec = await store.create({ userId: USER_A, inputUrl: 'down.com', normalizedUrl: 'https://down.com/', mode: 'website' });
    await store.fail(rec.id, { code: 'site_unreachable', message: 'We couldn’t reach that website.', detail: 'ENOTFOUND' }, { evidencePages: [], rejectedClaims: [], warnings: [], timings: { crawlMs: 3 } });
    const failed = (await store.get(rec.id))!;
    expect(failed.error).toEqual({ code: 'site_unreachable', message: 'We couldn’t reach that website.' });
    expect((failed.debug as { errorDetail?: string }).errorDetail).toBe('ENOTFOUND');

    const stuck = await store.create({ userId: USER_A, inputUrl: 's.com', normalizedUrl: 'https://s.com/', mode: 'website' });
    // Backdate without the updated_at trigger rewriting it.
    const c = await pool.connect();
    await c.query("begin; set local session_replication_role = replica;");
    await c.query("update public.business_analyses set updated_at = now() - interval '1 hour' where id = $1", [stuck.id]);
    await c.query('commit');
    c.release();
    expect(await store.failStale(new Date(Date.now() - 60_000))).toBeGreaterThanOrEqual(1);
    expect((await store.get(stuck.id))!.error?.code).toBe('interrupted');
  });

  it('RLS: users can read only their own analyses and pages, and cannot write analyses', async () => {
    const rec = await store.create({ userId: USER_A, inputUrl: 'rls.com', normalizedUrl: 'https://rls.com/', mode: 'website' });
    await store.savePages(rec.id, [
      { url: 'https://rls.com/', finalUrl: 'https://rls.com/', pageType: 'home', depth: 0, priority: 100, statusCode: 200, title: null, metaDescription: null, h1: null, headings: [], content: 'x', structuredData: [], siteName: null, fetchedAt: new Date().toISOString() },
    ]);
    const client = await pool.connect();
    try {
      await client.query('begin; set local role authenticated;');
      await client.query(`select set_config('request.jwt.claim.sub', '${USER_B}', true)`);
      expect((await client.query('select id from public.business_analyses where id = $1', [rec.id])).rowCount).toBe(0);
      expect((await client.query('select id from public.crawled_pages where analysis_id = $1', [rec.id])).rowCount).toBe(0);
      await client.query(`select set_config('request.jwt.claim.sub', '${USER_A}', true)`);
      expect((await client.query('select id from public.business_analyses where id = $1', [rec.id])).rowCount).toBe(1);
      expect((await client.query('select id from public.crawled_pages where analysis_id = $1', [rec.id])).rowCount).toBe(1);
      await expect(
        client.query(`insert into public.business_analyses (user_id, website_url, provider) values ('${USER_A}', 'https://evil.com', 'x')`),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});
