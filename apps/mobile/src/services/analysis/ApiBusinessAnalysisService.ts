import { ApiError, apiRequest } from '@/services/api/client';
import type { AnalysisJob } from '@/services/api/types';
import { delay } from '@/lib/storage';
import {
  ANALYSIS_STAGES,
  AnalysisFailure,
  AnalysisFailureCode,
  AnalysisStage,
  AnalyzeOptions,
  BusinessAnalysis,
  BusinessAnalysisService,
} from './BusinessAnalysisService';
import { mapServerResult } from './mapServerResult';
import { completedStages } from './progress';

const POLL_MS = 1200;
const MAX_WAIT_MS = 4 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 4;

/**
 * Real analysis: POST /business/analyze, then poll the job. Crawling and AI
 * run on the server — the app never sees any secret.
 */
export class ApiBusinessAnalysisService implements BusinessAnalysisService {
  async analyzeWebsite(url: string, options: AnalyzeOptions = {}): Promise<BusinessAnalysis> {
    const { onStageComplete, onJobCreated, resumeJobId, manual, signal } = options;
    let jobId = resumeJobId;

    if (!jobId) {
      try {
        const created = await apiRequest<AnalysisJob & { jobId: string }>('/business/analyze', {
          method: 'POST',
          body: { url, manual },
          signal,
        });
        jobId = created.jobId;
      } catch (e) {
        throw toFailure(e);
      }
      onJobCreated?.(jobId);
    }

    let reported = 0;
    const report = (count: number) => {
      while (reported < count) onStageComplete?.(ANALYSIS_STAGES[reported++] as AnalysisStage);
    };

    const started = Date.now();
    let pollErrors = 0;
    while (Date.now() - started < MAX_WAIT_MS) {
      let job: AnalysisJob;
      try {
        job = await apiRequest<AnalysisJob>(`/business/analysis/${jobId}`, { signal });
        pollErrors = 0;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        // A resumed job that no longer exists (e.g. server restarted) → start over.
        if (e instanceof ApiError && e.status === 404) throw new AnalysisFailure('interrupted', 'That analysis expired. Let’s try again.');
        if (++pollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) throw toFailure(e);
        await delay(POLL_MS * pollErrors, signal);
        continue;
      }

      if (job.status === 'failed') {
        throw new AnalysisFailure(knownCode(job.error?.code));
      }
      if (job.status === 'completed' && job.result) {
        report(ANALYSIS_STAGES.length);
        return mapServerResult(job.result);
      }
      report(completedStages(job));
      await delay(POLL_MS, signal);
    }
    throw new AnalysisFailure('timeout');
  }
}

const KNOWN: AnalysisFailureCode[] = [
  'invalid_url',
  'unsafe_url',
  'site_unreachable',
  'crawl_blocked',
  'not_html',
  'insufficient_content',
  'ai_not_configured',
  'ai_failed',
  'ai_invalid_output',
  'timeout',
  'interrupted',
  'rate_limited',
];

function knownCode(code: string | undefined): AnalysisFailureCode {
  return KNOWN.includes(code as AnalysisFailureCode) ? (code as AnalysisFailureCode) : 'unknown';
}

function toFailure(e: unknown): AnalysisFailure | Error {
  if (e instanceof AnalysisFailure) return e;
  if (e instanceof Error && e.name === 'AbortError') return e;
  if (e instanceof ApiError) {
    if (e.code === 'network') return new AnalysisFailure('network');
    if (e.status === 401) return new AnalysisFailure('unknown', 'Your session expired. Please sign in again.');
    return new AnalysisFailure(knownCode(e.code));
  }
  return new AnalysisFailure('unknown');
}
