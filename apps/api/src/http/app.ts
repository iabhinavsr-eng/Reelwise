import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { PIPELINE_VERSION } from '../analysis/pipeline.js';
import { AnalysisError } from '../crawler/errors.js';
import { assertPublicUrl } from '../crawler/ssrf.js';
import { canonicalKey, normalizeInputUrl } from '../crawler/url.js';
import type { AnalysisJobRunner } from '../jobs/AnalysisJobRunner.js';
import type { AnalysisRecord, AnalysisStore } from '../store/AnalysisStore.js';
import type { Authenticator, AuthUser } from './auth.js';

export interface AppDeps {
  store: AnalysisStore;
  runner: AnalysisJobRunner;
  auth: Authenticator;
  options: { ratePerHour: number; debugEndpoints: boolean; corsOrigins: string[]; aiConfigured: boolean };
}

const AnalyzeBody = z.object({
  url: z.string().min(1).max(2048),
  manual: z
    .object({
      businessName: z.string().trim().min(1).max(200),
      whatYouDo: z.string().trim().min(3).max(2000),
      customers: z.string().trim().max(2000).optional(),
      differentiators: z.string().trim().max(2000).optional(),
    })
    .optional(),
});

/** Public shape of a job — never includes debug data. */
function presentJob(r: AnalysisRecord) {
  return {
    id: r.id,
    status: r.status,
    phase: r.phase,
    progress: r.progress,
    version: r.version,
    mode: r.mode,
    url: r.normalizedUrl,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
    durationMs: r.durationMs,
    error: r.error,
    result: r.status === 'completed' ? r.result : null,
  };
}

type Env = { Variables: { user: AuthUser } };

export function createApp(deps: AppDeps) {
  const app = new Hono<Env>();

  if (deps.options.corsOrigins.length) {
    app.use('*', cors({ origin: deps.options.corsOrigins.includes('*') ? '*' : deps.options.corsOrigins, allowHeaders: ['authorization', 'content-type', 'x-dev-user-id'] }));
  }

  app.get('/health', (c) => c.json({ ok: true, pipelineVersion: PIPELINE_VERSION, aiConfigured: deps.options.aiConfigured }));

  app.use('/business/*', async (c, next) => {
    const user = await deps.auth.authenticate(c.req.raw.headers);
    if (!user) return c.json({ error: { code: 'unauthorized', message: 'Please sign in again.' } }, 401);
    c.set('user', user);
    await next();
  });

  const loadOwned = async (id: string, user: AuthUser) => {
    const record = await deps.store.get(id);
    // Same response for "missing" and "not yours" — don't leak ids.
    return record && record.userId === user.id ? record : null;
  };

  app.post('/business/analyze', async (c) => {
    const user = c.get('user');
    const parsed = AnalyzeBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: { code: 'invalid_request', message: 'Send { "url": "https://…" }.' } }, 400);

    let url: URL;
    try {
      url = normalizeInputUrl(parsed.data.url);
      assertPublicUrl(url);
    } catch (e) {
      const err = e instanceof AnalysisError ? e : new AnalysisError('invalid_url', 'Invalid URL');
      return c.json({ error: { code: err.code, message: err.message } }, 400);
    }

    const recent = await deps.store.countSince(user.id, new Date(Date.now() - 60 * 60 * 1000));
    if (recent >= deps.options.ratePerHour) {
      return c.json({ error: { code: 'rate_limited', message: 'You’ve analyzed a lot of websites recently. Please try again later.' } }, 429);
    }

    const record = await deps.store.create({
      userId: user.id,
      inputUrl: parsed.data.url,
      normalizedUrl: url.toString(),
      mode: parsed.data.manual ? 'manual' : 'website',
      manualInput: parsed.data.manual,
    });
    deps.runner.enqueue(record);
    return c.json({ jobId: record.id, ...presentJob(record), siteKey: canonicalKey(url) }, 202);
  });

  app.get('/business/analysis/:id', async (c) => {
    const record = await loadOwned(c.req.param('id'), c.get('user'));
    if (!record) return c.json({ error: { code: 'not_found', message: 'Analysis not found.' } }, 404);
    return c.json(presentJob(record));
  });

  app.get('/business/analysis/:id/debug', async (c) => {
    if (!deps.options.debugEndpoints) return c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
    const record = await loadOwned(c.req.param('id'), c.get('user'));
    if (!record) return c.json({ error: { code: 'not_found', message: 'Analysis not found.' } }, 404);
    const pages = await deps.store.getPages(record.id);
    return c.json({
      job: presentJob(record),
      pipelineVersion: record.pipelineVersion,
      model: record.model,
      debug: record.debug,
      pages: pages.map((p) => ({
        url: p.finalUrl,
        pageType: p.pageType,
        depth: p.depth,
        priority: p.priority,
        title: p.title,
        metaDescription: p.metaDescription,
        h1: p.h1,
        headings: p.headings,
        structuredData: p.structuredData,
        content: p.content,
      })),
    });
  });

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: { code: 'internal', message: 'Something went wrong.' } }, 500);
  });

  return app;
}
