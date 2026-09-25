import { env } from '@/config/env';
import { ApiBusinessAnalysisService } from './ApiBusinessAnalysisService';
import type { BusinessAnalysisService } from './BusinessAnalysisService';
import { MockBusinessAnalysisService } from './MockBusinessAnalysisService';

export * from './BusinessAnalysisService';

/** Real pipeline when the Reelwise API is configured; on-device mock otherwise. */
export const businessAnalysisService: BusinessAnalysisService =
  env.analysisProvider === 'api' ? new ApiBusinessAnalysisService() : new MockBusinessAnalysisService();
