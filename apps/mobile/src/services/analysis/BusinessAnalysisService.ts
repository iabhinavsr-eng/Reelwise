import type {
  AudienceProfile,
  BusinessProfile,
  ContentGoal,
  ValueProposition,
  VoiceTrait,
} from '@/domain/types';
import { AppError } from '@/lib/errors';
import type { ServerAnalysisResult } from '@/services/api/types';

/** Stages shown on the "Learning your business…" screen, in order. */
export const ANALYSIS_STAGES = ['reading', 'services', 'positioning', 'audience', 'value'] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

/** Everything the AI drafts for the user to review (suggestions, not approved data). */
export interface BusinessAnalysis {
  business: BusinessProfile;
  audience: AudienceProfile;
  valueProposition: ValueProposition;
  /** Pre-selected on the goals/voice screens — the user confirms instead of creating. */
  suggestedGoals: ContentGoal[];
  suggestedVoiceTraits: VoiceTrait[];
  /** Which implementation produced this: 'api' | 'mock'. */
  provider: string;
  analyzedAt: string;
  /** Server analysis id + version (API only) — links approved data to its source. */
  analysisId?: string;
  version?: number;
  /** Full server result with evidence, sources and confidence (API only). */
  details?: ServerAnalysisResult;
}

/** Answers from the "we couldn't learn enough" fallback form. */
export interface ManualBusinessInput {
  businessName: string;
  whatYouDo: string;
  customers?: string;
  differentiators?: string;
}

export interface AnalyzeOptions {
  /** Called as each stage completes, so the UI can tick it off. */
  onStageComplete?: (stage: AnalysisStage) => void;
  /** Called once the server has accepted the job (so a restart can resume polling it). */
  onJobCreated?: (jobId: string) => void;
  /** Resume polling an existing job instead of starting a new one. */
  resumeJobId?: string;
  manual?: ManualBusinessInput;
  signal?: AbortSignal;
}

export type AnalysisFailureCode =
  | 'invalid_url'
  | 'unsafe_url'
  | 'site_unreachable'
  | 'crawl_blocked'
  | 'not_html'
  | 'insufficient_content'
  | 'ai_not_configured'
  | 'ai_failed'
  | 'ai_invalid_output'
  | 'timeout'
  | 'interrupted'
  | 'rate_limited'
  | 'network'
  | 'unknown';

/** Failures after which asking the owner a few questions is the best way forward. */
const MANUAL_FALLBACK: AnalysisFailureCode[] = [
  'site_unreachable',
  'crawl_blocked',
  'not_html',
  'insufficient_content',
  'ai_failed',
  'ai_invalid_output',
  'timeout',
  'interrupted',
];

export class AnalysisFailure extends AppError {
  readonly offerManualFallback: boolean;
  readonly offerDifferentUrl: boolean;

  constructor(
    readonly code: AnalysisFailureCode,
    message?: string,
  ) {
    super(message ?? friendlyAnalysisMessage(code), code === 'network' ? 'network' : 'unknown');
    this.offerManualFallback = MANUAL_FALLBACK.includes(code);
    this.offerDifferentUrl = code !== 'network' && code !== 'rate_limited' && code !== 'ai_not_configured';
  }
}

export function friendlyAnalysisMessage(code: string): string {
  switch (code) {
    case 'invalid_url':
    case 'unsafe_url':
      return 'That doesn’t look like a public website address. Check it and try again.';
    case 'site_unreachable':
      return 'We couldn’t reach your website. It may be down or the address may be off.';
    case 'crawl_blocked':
      return 'Your website blocked us from reading it.';
    case 'not_html':
      return 'That address isn’t a web page we can read.';
    case 'insufficient_content':
      return 'Your website doesn’t have enough text for us to understand the business yet.';
    case 'rate_limited':
      return 'You’ve analyzed a lot of websites recently. Please try again in a little while.';
    case 'network':
      return 'You seem to be offline. Check your connection and try again.';
    case 'timeout':
      return 'Reading your website took too long.';
    case 'ai_not_configured':
      return 'Business analysis isn’t available right now. Please try again later.';
    default:
      return 'Something went wrong while learning about your business.';
  }
}

/**
 * Turns a business website (or the owner's answers) into a draft business
 * profile, audience (ICP) and value proposition (UVP).
 *
 * - ApiBusinessAnalysisService — the real pipeline on the Reelwise API.
 * - MockBusinessAnalysisService — on-device fixtures for demo mode.
 */
export interface BusinessAnalysisService {
  analyzeWebsite(url: string, options?: AnalyzeOptions): Promise<BusinessAnalysis>;
}
