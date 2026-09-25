import { AppError, isNetworkError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { abortError } from '@/lib/storage';
import { ANALYSIS_STAGES, AnalyzeOptions, BusinessAnalysis, BusinessAnalysisService } from './BusinessAnalysisService';

/**
 * Production path: the `analyze-business` Supabase Edge Function crawls the
 * site and runs the AI with server-side secrets. The client only sends the URL.
 *
 * The function is a single request today, so stage ticks are paced locally
 * while we wait; when the function streams real progress, map it here.
 */
export class EdgeFunctionBusinessAnalysisService implements BusinessAnalysisService {
  async analyzeWebsite(url: string, { onStageComplete, signal }: AnalyzeOptions = {}): Promise<BusinessAnalysis> {
    let stageIndex = 0;
    const ticker = setInterval(() => {
      // Tick every stage but the last; the last completes with the response.
      if (stageIndex < ANALYSIS_STAGES.length - 1) onStageComplete?.(ANALYSIS_STAGES[stageIndex++]);
    }, 1200);

    try {
      const { data, error } = await getSupabase().functions.invoke<BusinessAnalysis>('analyze-business', {
        body: { url },
      });
      if (signal?.aborted) throw abortError();
      if (error || !data) {
        if (error && isNetworkError(error)) throw error;
        throw new AppError('We couldn’t read that website. Check the address and try again.', 'unknown', error);
      }
      while (stageIndex < ANALYSIS_STAGES.length) onStageComplete?.(ANALYSIS_STAGES[stageIndex++]);
      return data;
    } finally {
      clearInterval(ticker);
    }
  }
}
