import type { AnalysisJob } from '@/services/api/types';
import { ANALYSIS_STAGES } from './BusinessAnalysisService';

/** Which UI stages are finished for a given server state. Real signals only. */
export function completedStages(job: Pick<AnalysisJob, 'status' | 'phase'>): number {
  if (job.status === 'completed') return ANALYSIS_STAGES.length;
  if (job.status === 'analyzing' && job.phase === 'positioning') return 3; // read, services, positioning
  if (job.status === 'analyzing') return 1; // website read; now extracting services
  return 0; // queued / crawling
}
