import { env } from '@/config/env';
import type { BusinessAnalysisService } from './BusinessAnalysisService';
import { EdgeFunctionBusinessAnalysisService } from './EdgeFunctionBusinessAnalysisService';
import { MockBusinessAnalysisService } from './MockBusinessAnalysisService';

export * from './BusinessAnalysisService';

export const businessAnalysisService: BusinessAnalysisService =
  env.analysisProvider === 'edge' && env.isSupabaseConfigured
    ? new EdgeFunctionBusinessAnalysisService()
    : new MockBusinessAnalysisService();
