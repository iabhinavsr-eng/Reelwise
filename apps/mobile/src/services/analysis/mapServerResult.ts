import type { ServerAnalysisResult } from '@/services/api/types';
import type { BusinessAnalysis } from './BusinessAnalysisService';

/**
 * Server analysis → the simpler shape the onboarding screens edit. The full
 * result (evidence, sources, confidence) stays attached as `details`.
 */
export function mapServerResult(r: ServerAnalysisResult): BusinessAnalysis {
  const services = r.business.services.length ? r.business.services : r.business.products;
  return {
    business: {
      name: r.business.name?.value ?? '',
      websiteUrl: r.websiteUrl,
      industry: r.business.industry ?? '',
      primaryLocation: r.business.locations[0]?.value ?? '',
      description: r.business.description ?? '',
      services: services.map((s) => s.value),
    },
    audience: {
      summary: r.audience.summary,
      structuredAttributes: {
        locations: r.audience.locations,
        ageRanges: r.audience.ageRanges,
        customerTypes: r.audience.customerTypes,
        needs: r.audience.needs,
        painPoints: r.audience.painPoints,
        motivations: r.audience.motivations,
        behaviors: r.audience.behaviors,
      },
    },
    valueProposition: { summary: r.valueProposition.summary },
    suggestedGoals: r.suggestedGoals,
    suggestedVoiceTraits: r.brandVoice.suggestedTraits,
    provider: 'api',
    analyzedAt: r.analyzedAt,
    analysisId: r.analysisId,
    version: r.version,
    details: r,
  };
}
