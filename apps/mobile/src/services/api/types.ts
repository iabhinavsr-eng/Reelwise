/**
 * Response shapes of the Reelwise API (apps/api). Mirrors
 * apps/api/src/analysis/types.ts — keep in sync.
 */
import type { ContentGoal, VoiceTrait } from '@/domain/types';

export type Confidence = 'high' | 'medium' | 'low';

export interface SourcedValue {
  value: string;
  sources: string[];
}

export interface EvidenceFact {
  id: string;
  category: string;
  statement: string;
  quote: string;
  sources: string[];
}

export interface Inference {
  id: string;
  category: 'industry' | 'audience' | 'value_proposition' | 'voice' | 'goals';
  statement: string;
  basedOn: string[];
}

export interface ServerAnalysisResult {
  analysisId: string;
  version: number;
  pipelineVersion: string;
  mode: 'website' | 'manual';
  websiteUrl: string;
  analyzedAt: string;
  business: {
    name: SourcedValue | null;
    website: string;
    industry: string | null;
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
  valueProposition: { summary: string; differentiators: SourcedValue[]; problemsSolved: string[]; benefits: string[] };
  brandVoice: { suggestedTraits: VoiceTrait[]; observedTone: string | null };
  suggestedGoals: ContentGoal[];
  evidence: EvidenceFact[];
  inferences: Inference[];
  confidence: Record<'name' | 'industry' | 'services' | 'locations' | 'audience' | 'valueProposition', Confidence>;
}

export type JobStatus = 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed';

export interface AnalysisJob {
  id: string;
  status: JobStatus;
  phase: 'profile' | 'positioning' | null;
  progress: { pagesCrawled?: number; pagesPlanned?: number };
  version: number;
  mode: 'website' | 'manual';
  url: string;
  createdAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: { code: string; message: string } | null;
  result: ServerAnalysisResult | null;
}

export interface AnalysisDebugResponse {
  job: AnalysisJob;
  pipelineVersion: string | null;
  model: string | null;
  debug: {
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
    timings: Record<string, number>;
    usage?: Record<string, number>;
    errorDetail?: unknown;
  } | null;
  pages: {
    url: string;
    pageType: string;
    depth: number;
    priority: number;
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    headings: string[];
    structuredData: unknown[];
    content: string;
  }[];
}
