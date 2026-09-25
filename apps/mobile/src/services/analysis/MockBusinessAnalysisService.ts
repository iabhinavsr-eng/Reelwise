import { AppError } from '@/lib/errors';
import { delay } from '@/lib/storage';
import { fixtureFor, nameFromUrl } from '@/services/mock/industryFixtures';
import { ANALYSIS_STAGES, AnalyzeOptions, BusinessAnalysis, BusinessAnalysisService } from './BusinessAnalysisService';

/**
 * Development stand-in for real crawling + AI. Picks a realistic industry
 * fixture from keywords in the URL and paces the stages so the UI feels real.
 *
 * Tip: a URL containing "offline" simulates a network failure, so the
 * error/retry state can be exercised.
 */
export class MockBusinessAnalysisService implements BusinessAnalysisService {
  constructor(private readonly stageDurationMs = 900) {}

  async analyzeWebsite(url: string, { onStageComplete, signal }: AnalyzeOptions = {}): Promise<BusinessAnalysis> {
    for (const stage of ANALYSIS_STAGES) {
      await delay(this.stageDurationMs, signal);
      if (stage === 'reading' && url.includes('offline')) {
        throw new AppError('We couldn’t reach that website. Check the address or your connection and try again.', 'network');
      }
      onStageComplete?.(stage);
    }

    const fixture = fixtureFor(url);
    const name = nameFromUrl(url) || 'Your Business';
    return {
      business: {
        name,
        websiteUrl: url,
        industry: fixture.industry,
        primaryLocation: fixture.primaryLocation,
        description: fixture.description(name),
        services: [...fixture.services],
      },
      audience: { summary: fixture.audienceSummary, structuredAttributes: fixture.audienceAttributes },
      valueProposition: { summary: fixture.valueProposition(name) },
      suggestedGoals: [...fixture.goals],
      suggestedVoiceTraits: [...fixture.voice],
      provider: 'mock',
      analyzedAt: new Date().toISOString(),
    };
  }
}
