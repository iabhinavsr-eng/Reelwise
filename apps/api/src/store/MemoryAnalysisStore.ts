import { randomUUID } from 'node:crypto';

import type { WebsitePage } from '../crawler/crawl.js';
import type { AnalysisRecord, AnalysisStatus, AnalysisStore, CreateAnalysisInput, StoredPage } from './AnalysisStore.js';

/** Development / test store. Data is lost on restart. */
export class MemoryAnalysisStore implements AnalysisStore {
  private readonly records = new Map<string, AnalysisRecord>();
  private readonly pages = new Map<string, StoredPage[]>();

  async create(input: CreateAnalysisInput): Promise<AnalysisRecord> {
    const previous = [...this.records.values()].filter((r) => r.userId === input.userId && r.normalizedUrl === input.normalizedUrl);
    const now = new Date().toISOString();
    const record: AnalysisRecord = {
      id: randomUUID(),
      userId: input.userId,
      inputUrl: input.inputUrl,
      normalizedUrl: input.normalizedUrl,
      mode: input.mode,
      manualInput: input.manualInput ?? null,
      status: 'queued',
      phase: null,
      progress: {},
      version: previous.reduce((max, r) => Math.max(max, r.version), 0) + 1,
      pipelineVersion: null,
      model: null,
      result: null,
      debug: null,
      error: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      updatedAt: now,
    };
    this.records.set(record.id, record);
    return structuredClone(record);
  }

  private patch(id: string, patch: Partial<AnalysisRecord>) {
    const r = this.records.get(id);
    if (r) this.records.set(id, { ...r, ...patch, updatedAt: new Date().toISOString() });
  }

  async updateStatus(id: string, status: AnalysisStatus, patch: { phase?: AnalysisRecord['phase']; progress?: AnalysisRecord['progress'] } = {}) {
    const r = this.records.get(id);
    if (!r || r.status === 'completed' || r.status === 'failed') return;
    this.patch(id, {
      status,
      phase: patch.phase !== undefined ? patch.phase : r.phase,
      progress: patch.progress ?? r.progress,
      startedAt: r.startedAt ?? new Date().toISOString(),
    });
  }

  async savePages(id: string, pages: WebsitePage[]) {
    this.pages.set(id, pages.map((p) => ({ ...p, id: randomUUID(), analysisId: id })));
  }

  async complete(id: string, result: AnalysisRecord['result'] & object, debug: AnalysisRecord['debug'] & object, meta: { pipelineVersion: string; model: string | null }) {
    const r = this.records.get(id);
    if (!r) return;
    const completedAt = new Date();
    this.patch(id, {
      status: 'completed',
      phase: null,
      result,
      debug,
      pipelineVersion: meta.pipelineVersion,
      model: meta.model,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - new Date(r.startedAt ?? r.createdAt).getTime(),
    });
  }

  async fail(id: string, error: { code: NonNullable<AnalysisRecord['error']>['code']; message: string }, debug: AnalysisRecord['debug']) {
    const r = this.records.get(id);
    if (!r) return;
    const completedAt = new Date();
    this.patch(id, {
      status: 'failed',
      phase: null,
      error: { code: error.code, message: error.message },
      debug,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - new Date(r.startedAt ?? r.createdAt).getTime(),
    });
  }

  async get(id: string) {
    const r = this.records.get(id);
    return r ? structuredClone(r) : null;
  }

  async getPages(id: string) {
    return structuredClone(this.pages.get(id) ?? []);
  }

  async countSince(userId: string, since: Date) {
    return [...this.records.values()].filter((r) => r.userId === userId && new Date(r.createdAt) >= since).length;
  }

  async failStale(olderThan: Date) {
    let n = 0;
    for (const r of this.records.values()) {
      if (!['completed', 'failed'].includes(r.status) && new Date(r.updatedAt) < olderThan) {
        await this.fail(r.id, { code: 'interrupted', message: 'The analysis was interrupted. Please try again.' }, r.debug);
        n++;
      }
    }
    return n;
  }
}
