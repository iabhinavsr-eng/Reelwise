import type {
  AudienceProfile,
  BusinessProfile,
  ContentGoal,
  ValueProposition,
  VoiceTrait,
} from '@/domain/types';

/** Stages shown on the "Learning your business…" screen, in order. */
export const ANALYSIS_STAGES = ['reading', 'services', 'positioning', 'audience', 'value'] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

/** Everything the AI drafts for the user to review. */
export interface BusinessAnalysis {
  business: BusinessProfile;
  audience: AudienceProfile;
  valueProposition: ValueProposition;
  /** Pre-selected on the goals/voice screens — the user confirms instead of creating. */
  suggestedGoals: ContentGoal[];
  suggestedVoiceTraits: VoiceTrait[];
  /** Which implementation produced this (for debugging/analytics). */
  provider: string;
  analyzedAt: string;
}

export interface AnalyzeOptions {
  /** Called as each stage completes, so the UI can tick it off. */
  onStageComplete?: (stage: AnalysisStage) => void;
  signal?: AbortSignal;
}

/**
 * Turns a business website into a draft business profile, audience (ICP) and
 * value proposition (UVP).
 *
 * Implementations:
 * - MockBusinessAnalysisService — realistic canned output, runs on-device.
 * - EdgeFunctionBusinessAnalysisService — calls the `analyze-business`
 *   Supabase Edge Function, where crawling + AI run with server-side secrets.
 *
 * Swapping implementations is a one-line change in `./index.ts`.
 */
export interface BusinessAnalysisService {
  analyzeWebsite(url: string, options?: AnalyzeOptions): Promise<BusinessAnalysis>;
}
