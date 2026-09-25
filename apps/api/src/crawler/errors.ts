/**
 * Every failure the pipeline can surface. The app maps these codes to
 * customer-friendly copy and decides whether to offer the manual fallback.
 */
export type AnalysisErrorCode =
  | 'invalid_url'
  | 'unsafe_url'
  | 'site_unreachable'
  | 'crawl_blocked'
  | 'not_html'
  | 'insufficient_content'
  | 'ai_not_configured'
  | 'ai_failed'
  | 'ai_invalid_output'
  | 'timeout'
  | 'interrupted'
  | 'internal';

export class AnalysisError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export function toAnalysisError(e: unknown): AnalysisError {
  if (e instanceof AnalysisError) return e;
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
    return new AnalysisError('timeout', 'The analysis took too long.', e.message);
  }
  return new AnalysisError('internal', 'Unexpected error during analysis.', e instanceof Error ? e.message : String(e));
}
