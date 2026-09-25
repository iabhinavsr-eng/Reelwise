/**
 * The analysis contract returned to the app and stored in the database.
 * Mirrored in apps/mobile/src/services/api/types.ts — keep them in sync.
 *
 * FACTS are things the website states, each with source URLs and a verified
 * quote. INFERENCES are the AI's reasoning (audience, value proposition,
 * voice) and always reference the facts they're based on. They are never
 * mixed.
 */
export type Confidence = 'high' | 'medium' | 'low';

export const VOICE_TRAITS = ['conversational', 'warm', 'straightforward', 'professional', 'playful', 'bold', 'educational'] as const;
export type VoiceTrait = (typeof VOICE_TRAITS)[number];

export const CONTENT_GOALS = ['educate', 'build_trust', 'get_leads', 'grow_followers', 'promote_services', 'stay_top_of_mind'] as const;
export type ContentGoal = (typeof CONTENT_GOALS)[number];

export const FACT_CATEGORIES = [
  'identity',
  'service',
  'product',
  'location',
  'service_area',
  'audience_served',
  'differentiator',
  'credential',
  'offer',
  'pricing',
  'process',
  'contact',
  'other',
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

/** A value stated on the website, with the page(s) that say it. */
export interface SourcedValue {
  value: string;
  sources: string[];
}

export interface Fact {
  id: string; // F1, F2, …
  category: FactCategory;
  statement: string;
  quote: string;
  sources: string[];
}

export interface Inference {
  id: string; // I1, I2, …
  category: 'industry' | 'audience' | 'value_proposition' | 'voice' | 'goals';
  statement: string;
  basedOn: string[]; // fact ids
}

export interface AnalysisResult {
  analysisId: string;
  version: number;
  pipelineVersion: string;
  mode: 'website' | 'manual';
  websiteUrl: string;
  analyzedAt: string;
  business: {
    name: SourcedValue | null;
    website: string;
    industry: string | null; // a categorization → inference
    description: string | null;
    locations: SourcedValue[];
    serviceAreas: SourcedValue[];
    services: SourcedValue[];
    products: SourcedValue[];
  };
  audience: {
    summary: string;
    customerTypes: string[];
    needs: string[];
    painPoints: string[];
    motivations: string[];
    behaviors: string[];
    locations: string[];
    ageRanges: string[];
  };
  valueProposition: {
    summary: string;
    differentiators: SourcedValue[];
    problemsSolved: string[];
    benefits: string[];
  };
  brandVoice: { suggestedTraits: VoiceTrait[]; observedTone: string | null };
  suggestedGoals: ContentGoal[];
  evidence: Fact[];
  inferences: Inference[];
  confidence: {
    name: Confidence;
    industry: Confidence;
    services: Confidence;
    locations: Confidence;
    audience: Confidence;
    valueProposition: Confidence;
  };
}

/** Owner-provided answers used by the "couldn't learn enough" fallback. */
export interface ManualInput {
  businessName: string;
  whatYouDo: string;
  customers?: string;
  differentiators?: string;
}

/** Everything useful for tuning — returned by the debug endpoint only. */
export interface AnalysisDebug {
  crawl?: {
    rootUrl: string;
    pagesCrawled: number;
    discovered: number;
    skipped: { url: string; reason: string }[];
    errors: { url: string; reason: string }[];
    robotsFound: boolean;
    sitemapUrls: number;
    durationMs: number;
  };
  evidencePages: { id: string; url: string; pageType: string; chars: number }[];
  rejectedClaims: { kind: string; value: string; reason: string }[];
  warnings: string[];
  rawProfile?: unknown;
  rawPositioning?: unknown;
  timings: Record<string, number>;
  model?: string;
  promptVersions?: Record<string, string>;
  usage?: Record<string, number>;
}
