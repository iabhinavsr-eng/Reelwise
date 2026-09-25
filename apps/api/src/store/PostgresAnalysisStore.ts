import pg from 'pg';

import type { WebsitePage } from '../crawler/crawl.js';
import type { AnalysisRecord, AnalysisStatus, AnalysisStore, CreateAnalysisInput, StoredPage } from './AnalysisStore.js';

/**
 * Supabase Postgres via a direct server-side connection (DATABASE_URL).
 * Runs as a privileged role, so RLS doesn't apply here — every query is
 * scoped explicitly, and ownership is checked in the HTTP layer.
 */
export class PostgresAnalysisStore implements AnalysisStore {
  constructor(private readonly pool: pg.Pool) {}

  static fromUrl(url: string) {
    const needsSsl = !/localhost|127\.0\.0\.1|sslmode=disable/.test(url);
    return new PostgresAnalysisStore(new pg.Pool({ connectionString: url, max: 5, ssl: needsSsl ? { rejectUnauthorized: false } : undefined }));
  }

  async close() {
    await this.pool.end();
  }

  async create(input: CreateAnalysisInput): Promise<AnalysisRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Serialize version numbering per user+site.
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`${input.userId}:${input.normalizedUrl}`]);
      const { rows: v } = await client.query<{ next: number }>(
        'select coalesce(max(version), 0) + 1 as next from public.business_analyses where user_id = $1 and normalized_url = $2',
        [input.userId, input.normalizedUrl],
      );
      const { rows } = await client.query(
        `insert into public.business_analyses
           (user_id, website_url, input_url, normalized_url, mode, manual_input, status, provider, version)
         values ($1, $2, $3, $2, $4, $5, 'queued', 'pending', $6)
         returning *`,
        [input.userId, input.normalizedUrl, input.inputUrl, input.mode, input.manualInput ? JSON.stringify(input.manualInput) : null, v[0].next],
      );
      await client.query('commit');
      return toRecord(rows[0]);
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async updateStatus(id: string, status: AnalysisStatus, patch: { phase?: AnalysisRecord['phase']; progress?: AnalysisRecord['progress'] } = {}) {
    await this.pool.query(
      `update public.business_analyses
         set status = $2,
             phase = case when $3::boolean then $4 else phase end,
             progress = coalesce($5::jsonb, progress),
             started_at = coalesce(started_at, now())
       where id = $1 and status not in ('completed', 'failed')`,
      [id, status, patch.phase !== undefined, patch.phase ?? null, patch.progress ? JSON.stringify(patch.progress) : null],
    );
  }

  async savePages(id: string, pages: WebsitePage[]) {
    if (!pages.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from public.crawled_pages where analysis_id = $1', [id]);
      for (const p of pages) {
        await client.query(
          `insert into public.crawled_pages
             (analysis_id, url, final_url, page_type, depth, priority, status_code, title, meta_description, h1, headings, content, structured_data, content_chars, fetched_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            id, p.url, p.finalUrl, p.pageType, p.depth, p.priority, p.statusCode, p.title, p.metaDescription, p.h1,
            JSON.stringify(p.headings), p.content, JSON.stringify(p.structuredData), p.content.length, p.fetchedAt,
          ],
        );
      }
      await client.query('commit');
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async complete(id: string, result: NonNullable<AnalysisRecord['result']>, debug: NonNullable<AnalysisRecord['debug']>, meta: { pipelineVersion: string; model: string | null }) {
    await this.pool.query(
      `update public.business_analyses
         set status = 'completed', phase = null, error = null, error_code = null,
             result = $2, suggested_profile = $3, suggested_audience = $4, suggested_value_proposition = $5,
             facts = $6, inferences = $7, confidence = $8, debug = $9,
             pipeline_version = $10, model = $11, provider = coalesce(split_part($11, ':', 1), provider),
             website_url = $12, analyzed_at = $13, completed_at = now(),
             duration_ms = (extract(epoch from (now() - coalesce(started_at, created_at))) * 1000)::int
       where id = $1`,
      [
        id,
        JSON.stringify(result),
        JSON.stringify(result.business),
        JSON.stringify(result.audience),
        JSON.stringify(result.valueProposition),
        JSON.stringify(result.evidence),
        JSON.stringify(result.inferences),
        JSON.stringify(result.confidence),
        JSON.stringify(debug),
        meta.pipelineVersion,
        meta.model,
        result.websiteUrl,
        result.analyzedAt,
      ],
    );
  }

  async fail(id: string, error: { code: NonNullable<AnalysisRecord['error']>['code']; message: string; detail?: unknown }, debug: AnalysisRecord['debug']) {
    await this.pool.query(
      `update public.business_analyses
         set status = 'failed', phase = null, error_code = $2, error = $3, debug = coalesce($4::jsonb, debug),
             completed_at = now(),
             duration_ms = (extract(epoch from (now() - coalesce(started_at, created_at))) * 1000)::int
       where id = $1`,
      [id, error.code, error.message, debug ? JSON.stringify({ ...debug, errorDetail: error.detail ?? null }) : null],
    );
  }

  async get(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { rows } = await this.pool.query('select * from public.business_analyses where id = $1', [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async getPages(id: string): Promise<StoredPage[]> {
    const { rows } = await this.pool.query('select * from public.crawled_pages where analysis_id = $1 order by depth, priority desc', [id]);
    return rows.map((r) => ({
      id: r.id,
      analysisId: r.analysis_id,
      url: r.url,
      finalUrl: r.final_url,
      pageType: r.page_type,
      depth: r.depth,
      priority: r.priority,
      statusCode: r.status_code,
      title: r.title,
      metaDescription: r.meta_description,
      h1: r.h1,
      headings: r.headings,
      content: r.content,
      structuredData: r.structured_data,
      siteName: null,
      fetchedAt: new Date(r.fetched_at).toISOString(),
    }));
  }

  async countSince(userId: string, since: Date) {
    const { rows } = await this.pool.query<{ n: string }>('select count(*) as n from public.business_analyses where user_id = $1 and created_at >= $2', [userId, since]);
    return Number(rows[0].n);
  }

  async failStale(olderThan: Date) {
    const { rowCount } = await this.pool.query(
      `update public.business_analyses
         set status = 'failed', error_code = 'interrupted', error = 'The analysis was interrupted. Please try again.', completed_at = now()
       where status in ('queued', 'crawling', 'analyzing') and updated_at < $1`,
      [olderThan],
    );
    return rowCount ?? 0;
  }
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecord(r: any): AnalysisRecord {
  return {
    id: r.id,
    userId: r.user_id,
    inputUrl: r.input_url ?? r.website_url,
    normalizedUrl: r.normalized_url ?? r.website_url,
    mode: r.mode,
    manualInput: r.manual_input,
    status: r.status,
    phase: r.phase,
    progress: r.progress ?? {},
    version: r.version,
    pipelineVersion: r.pipeline_version,
    model: r.model,
    result: r.status === 'completed' ? r.result : null,
    debug: r.debug,
    error: r.status === 'failed' ? { code: r.error_code ?? 'internal', message: r.error ?? 'Analysis failed.' } : null,
    createdAt: iso(r.created_at)!,
    startedAt: iso(r.started_at),
    completedAt: iso(r.completed_at),
    durationMs: r.duration_ms,
    updatedAt: iso(r.updated_at)!,
  };
}
