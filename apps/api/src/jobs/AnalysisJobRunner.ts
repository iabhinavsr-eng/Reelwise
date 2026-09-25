import { runAnalysisPipeline, PipelineDeps, PIPELINE_VERSION } from '../analysis/pipeline.js';
import type { AnalysisDebug } from '../analysis/types.js';
import { AnalysisError, toAnalysisError } from '../crawler/errors.js';
import type { AnalysisRecord, AnalysisStore } from '../store/AnalysisStore.js';

export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/**
 * Runs analyses in the background with a concurrency cap. State lives in the
 * store, so clients poll GET /business/analysis/:id and survive app restarts.
 *
 * Single-process by design for now; to scale out, move `run` behind a queue
 * (pg-boss, Supabase Queues, SQS) without changing the HTTP contract.
 */
export class AnalysisJobRunner {
  private active = 0;
  private readonly waiting: AnalysisRecord[] = [];

  constructor(
    private readonly store: AnalysisStore,
    private readonly deps: PipelineDeps,
    private readonly opts: { concurrency: number; timeoutMs: number },
    private readonly log: Logger,
  ) {}

  enqueue(record: AnalysisRecord) {
    this.waiting.push(record);
    this.drain();
  }

  /** Resolves when nothing is running or waiting (used by tests). */
  async idle(): Promise<void> {
    while (this.active > 0 || this.waiting.length > 0) await new Promise((r) => setTimeout(r, 10));
  }

  private drain() {
    while (this.active < this.opts.concurrency && this.waiting.length) {
      const next = this.waiting.shift()!;
      this.active++;
      this.run(next)
        .catch((e) => this.log.error({ err: String(e), analysisId: next.id }, 'analysis runner crashed'))
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }

  private async run(record: AnalysisRecord) {
    const debug: AnalysisDebug = { evidencePages: [], rejectedClaims: [], warnings: [], timings: {} };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new AnalysisError('timeout', 'The analysis took too long.')), this.opts.timeoutMs);
    const started = Date.now();
    try {
      const result = await runAnalysisPipeline(
        { analysisId: record.id, version: record.version, url: record.normalizedUrl, manual: record.manualInput ?? undefined },
        this.deps,
        debug,
        {
          onStatus: (status, detail) =>
            this.store.updateStatus(record.id, status, {
              phase: detail.phase ?? null,
              progress: detail.pagesCrawled !== undefined ? { pagesCrawled: detail.pagesCrawled, pagesPlanned: detail.pagesPlanned } : undefined,
            }),
          onCrawled: (crawl) => this.store.savePages(record.id, crawl.pages),
        },
        controller.signal,
      );
      if (controller.signal.aborted) throw new AnalysisError('timeout', 'The analysis took too long.');
      debug.timings.totalMs = Date.now() - started;
      await this.store.complete(record.id, result, debug, { pipelineVersion: PIPELINE_VERSION, model: debug.model ?? null });
      this.log.info({ analysisId: record.id, ms: debug.timings.totalMs, pages: debug.crawl?.pagesCrawled }, 'analysis completed');
    } catch (e) {
      const err = controller.signal.aborted ? new AnalysisError('timeout', 'The analysis took too long.') : toAnalysisError(e);
      debug.timings.totalMs = Date.now() - started;
      await this.store.fail(record.id, { code: err.code, message: err.message, detail: err.detail }, debug);
      this.log.warn({ analysisId: record.id, code: err.code, detail: err.detail }, 'analysis failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
