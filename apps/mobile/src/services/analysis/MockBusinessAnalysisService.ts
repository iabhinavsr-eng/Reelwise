import { delay } from '@/lib/storage';
import { fixtureFor, nameFromUrl } from '@/services/mock/industryFixtures';
import { ANALYSIS_STAGES, AnalysisFailure, AnalyzeOptions, BusinessAnalysis, BusinessAnalysisService } from './BusinessAnalysisService';

/**
 * Demo-mode stand-in used when EXPO_PUBLIC_API_URL isn't set. Picks a
 * realistic industry fixture from keywords in the URL.
 *
 * Simulations for exercising failure UX:
 *   URL contains "offline" → network failure
 *   URL contains "thin"    → "couldn't learn enough" → manual fallback
 */
export class MockBusinessAnalysisService implements BusinessAnalysisService {
  constructor(private readonly stageDurationMs = 900) {}

  async analyzeWebsite(url: string, { onStageComplete, signal, manual }: AnalyzeOptions = {}): Promise<BusinessAnalysis> {
    for (const stage of ANALYSIS_STAGES) {
      await delay(this.stageDurationMs, signal);
      if (stage === 'reading' && !manual && url.includes('offline')) throw new AnalysisFailure('network');
      if (stage === 'services' && !manual && url.includes('thin')) throw new AnalysisFailure('insufficient_content');
      onStageComplete?.(stage);
    }

    const fixture = fixtureFor(manual ? `${manual.whatYouDo} ${url}` : url);
    const name = manual?.businessName.trim() || nameFromUrl(url) || 'Your Business';
    return {
      business: {
        name,
        websiteUrl: url,
        industry: fixture.industry,
        primaryLocation: fixture.primaryLocation,
        description: manual?.whatYouDo.trim() || fixture.description(name),
        services: [...fixture.services],
      },
      audience: {
        summary: manual?.customers?.trim() || fixture.audienceSummary,
        structuredAttributes: fixture.audienceAttributes,
      },
      valueProposition: { summary: manual?.differentiators?.trim() || fixture.valueProposition(name) },
      suggestedGoals: [...fixture.goals],
      suggestedVoiceTraits: [...fixture.voice],
      provider: 'mock',
      analyzedAt: new Date().toISOString(),
    };
  }
}
