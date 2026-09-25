import type { WebsitePage } from '../crawler/crawl.js';
import type { AnalysisErrorCode } from '../crawler/errors.js';
import type { AnalysisDebug, AnalysisResult, ManualInput } from '../analysis/types.js';

export type AnalysisStatus = 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed';
export type AnalysisPhase = 'profile' | 'positioning' | null;

export interface AnalysisRecord {
  id: string;
  userId: string;
  inputUrl: string;
  normalizedUrl: string;
  mode: 'website' | 'manual';
  manualInput: ManualInput | null;
  status: AnalysisStatus;
  phase: AnalysisPhase;
  progress: { pagesCrawled?: number; pagesPlanned?: number };
  /** 1 for the first analysis of this site for this user, 2 for the next, … */
  version: number;
  pipelineVersion: string | null;
  model: string | null;
  result: AnalysisResult | null;
  debug: AnalysisDebug | null;
  error: { code: AnalysisErrorCode; message: string } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  updatedAt: string;
}

export interface StoredPage extends WebsitePage {
  id: string;
  analysisId: string;
}

export interface CreateAnalysisInput {
  userId: string;
  inputUrl: string;
  normalizedUrl: string;
  mode: 'website' | 'manual';
  manualInput?: ManualInput;
}

/**
 * Persistence for analysis jobs. Suggestions only — this store never writes
 * the user-approved profile (businesses / audience_profiles /
 * value_propositions). Re-analyzing always creates a new version.
 */
export interface AnalysisStore {
  create(input: CreateAnalysisInput): Promise<AnalysisRecord>;
  updateStatus(id: string, status: AnalysisStatus, patch?: { phase?: AnalysisPhase; progress?: AnalysisRecord['progress'] }): Promise<void>;
  savePages(id: string, pages: WebsitePage[]): Promise<void>;
  complete(id: string, result: AnalysisResult, debug: AnalysisDebug, meta: { pipelineVersion: string; model: string | null }): Promise<void>;
  fail(id: string, error: { code: AnalysisErrorCode; message: string; detail?: unknown }, debug: AnalysisDebug | null): Promise<void>;
  get(id: string): Promise<AnalysisRecord | null>;
  getPages(id: string): Promise<StoredPage[]>;
  countSince(userId: string, since: Date): Promise<number>;
  /** Marks jobs stuck in a non-terminal state (e.g. after a restart) as failed. */
  failStale(olderThan: Date): Promise<number>;
}
