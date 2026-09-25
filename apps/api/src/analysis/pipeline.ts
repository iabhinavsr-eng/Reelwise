import { crawlWebsite, CrawlResult } from '../crawler/crawl.js';
import { AnalysisError } from '../crawler/errors.js';
import type { Fetcher } from '../crawler/fetcher.js';
import { buildEvidence, usableChars } from './evidence.js';
import { buildPositioningUserPrompt, POSITIONING_PROMPT_VERSION, POSITIONING_SYSTEM_PROMPT } from './prompts/positioning.js';
import { buildProfileUserPrompt, PROFILE_PROMPT_VERSION, PROFILE_SYSTEM_PROMPT } from './prompts/profile.js';
import { AIProvider, AIProviderError } from './providers/AIProvider.js';
import { PositioningSchema, ProfileExtractionSchema } from './schema.js';
import type { AnalysisDebug, AnalysisResult, ManualInput } from './types.js';
import { Rejected, verifyPositioning, verifyProfile } from './verify.js';

export const PIPELINE_VERSION = `2.0.0+${PROFILE_PROMPT_VERSION}+${POSITIONING_PROMPT_VERSION}`;

/** Below this much readable text there's nothing meaningful to analyze. */
export const MIN_USABLE_CHARS = 400;

export interface PipelineInput {
  analysisId: string;
  version: number;
  url: string;
  manual?: ManualInput;
}

export interface PipelineDeps {
  fetcher: Fetcher;
  ai: AIProvider | null;
  crawl: { maxPages: number; maxDepth: number; concurrency: number; totalBudgetMs: number };
}

export interface PipelineHooks {
  onStatus?: (status: 'crawling' | 'analyzing', detail: { phase?: 'profile' | 'positioning'; pagesCrawled?: number; pagesPlanned?: number }) => void | Promise<void>;
  onCrawled?: (crawl: CrawlResult) => void | Promise<void>;
}

function aiError(e: unknown): AnalysisError {
  if (e instanceof AnalysisError) return e;
  if (e instanceof AIProviderError) {
    if (e.kind === 'not_configured') return new AnalysisError('ai_not_configured', 'AI analysis isn’t configured on the server.', e.message);
    if (e.kind === 'invalid_output') return new AnalysisError('ai_invalid_output', 'The AI returned an unusable answer.', e.detail ?? e.message);
    if (e.kind === 'timeout') return new AnalysisError('timeout', 'The AI took too long to respond.', e.message);
    return new AnalysisError('ai_failed', 'The AI analysis failed.', e.message);
  }
  return new AnalysisError('ai_failed', 'The AI analysis failed.', e instanceof Error ? e.message : String(e));
}

/**
 * URL (+ optional owner answers) → verified, structured analysis.
 * `debug` is filled progressively so failures are inspectable too.
 */
export async function runAnalysisPipeline(
  input: PipelineInput,
  deps: PipelineDeps,
  debug: AnalysisDebug,
  hooks: PipelineHooks = {},
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const timings: Record<string, number> = {};
  debug.timings = timings;
  const rejected: Rejected[] = [];
  debug.rejectedClaims = rejected;
  debug.warnings = debug.warnings ?? [];
  debug.promptVersions = { profile: PROFILE_PROMPT_VERSION, positioning: POSITIONING_PROMPT_VERSION };
  const mode = input.manual ? 'manual' : 'website';

  // 1. Crawl. In manual mode a failed crawl is fine — the owner's answers are the evidence.
  let crawl: CrawlResult | null = null;
  let t = Date.now();
  await hooks.onStatus?.('crawling', { pagesCrawled: 0 });
  try {
    crawl = await crawlWebsite(input.url, {
      fetcher: deps.fetcher,
      ...deps.crawl,
      signal,
      onProgress: (p) => void hooks.onStatus?.('crawling', p),
    });
  } catch (e) {
    if (mode === 'website') throw e;
    debug.warnings.push(`Crawl failed in manual mode: ${e instanceof Error ? e.message : String(e)}`);
  }
  timings.crawlMs = Date.now() - t;
  if (crawl) {
    debug.crawl = {
      rootUrl: crawl.rootUrl,
      pagesCrawled: crawl.pages.length,
      discovered: crawl.discoveredCount,
      skipped: crawl.skipped.slice(0, 100),
      errors: crawl.errors.slice(0, 50),
      robotsFound: crawl.robotsFound,
      sitemapUrls: crawl.sitemapUrls,
      durationMs: crawl.durationMs,
    };
    await hooks.onCrawled?.(crawl);
  }

  // 2. Evidence.
  const evidence = buildEvidence(crawl, input.manual, input.url);
  debug.evidencePages = evidence.pages.map((p) => ({ id: p.id, url: p.url, pageType: p.pageType, chars: p.content.length }));
  if (!input.manual && usableChars(evidence) < MIN_USABLE_CHARS) {
    throw new AnalysisError('insufficient_content', 'We couldn’t find enough readable content on this website.', {
      usableChars: usableChars(evidence),
    });
  }

  if (!deps.ai) throw new AnalysisError('ai_not_configured', 'AI analysis isn’t configured on the server.');
  debug.model = `${deps.ai.name}:${deps.ai.model}`;
  const usage = { inputTokens: 0, outputTokens: 0 };

  // 3. Facts.
  await hooks.onStatus?.('analyzing', { phase: 'profile' });
  t = Date.now();
  let profileRes;
  try {
    profileRes = await deps.ai.generateStructured({
      name: 'business_profile',
      system: PROFILE_SYSTEM_PROMPT,
      user: buildProfileUserPrompt(evidence),
      schema: ProfileExtractionSchema,
      signal,
    });
  } catch (e) {
    throw aiError(e);
  }
  timings.profileMs = Date.now() - t;
  debug.rawProfile = profileRes.raw;
  usage.inputTokens += profileRes.usage?.inputTokens ?? 0;
  usage.outputTokens += profileRes.usage?.outputTokens ?? 0;

  const profile = verifyProfile(profileRes.data, evidence, rejected);
  const understood = Boolean(profile.name || profile.services.length || profile.products.length || profile.description);
  if (profile.contentSufficiency === 'insufficient' || !understood) {
    throw new AnalysisError('insufficient_content', 'We couldn’t learn enough from this website.', {
      contentSufficiency: profile.contentSufficiency,
    });
  }
  if (profile.contentSufficiency === 'limited') debug.warnings.push('Model reported limited website content.');

  // 4. Inferences grounded in verified facts.
  await hooks.onStatus?.('analyzing', { phase: 'positioning' });
  t = Date.now();
  let positioningRes;
  try {
    positioningRes = await deps.ai.generateStructured({
      name: 'business_positioning',
      system: POSITIONING_SYSTEM_PROMPT,
      user: buildPositioningUserPrompt({
        businessName: profile.name?.value ?? null,
        industry: profile.industry,
        description: profile.description,
        services: profile.services.map((s) => s.value),
        products: profile.products.map((s) => s.value),
        locations: profile.locations.map((s) => s.value),
        serviceAreas: profile.serviceAreas.map((s) => s.value),
        facts: profile.facts,
        evidence,
      }),
      schema: PositioningSchema,
      signal,
    });
  } catch (e) {
    throw aiError(e);
  }
  timings.positioningMs = Date.now() - t;
  debug.rawPositioning = positioningRes.raw;
  usage.inputTokens += positioningRes.usage?.inputTokens ?? 0;
  usage.outputTokens += positioningRes.usage?.outputTokens ?? 0;
  debug.usage = usage;

  const positioning = verifyPositioning(positioningRes.data, profile.facts, rejected);
  debug.warnings.push(...positioning.warnings);

  const inferences = positioning.inferences;
  if (profile.industry) inferences.unshift({ id: 'I0', category: 'industry', statement: `Industry categorized as "${profile.industry}"`, basedOn: [] });

  return {
    analysisId: input.analysisId,
    version: input.version,
    pipelineVersion: PIPELINE_VERSION,
    mode,
    websiteUrl: crawl?.rootUrl ?? input.url,
    analyzedAt: new Date().toISOString(),
    business: {
      name: profile.name,
      website: crawl?.rootUrl ?? input.url,
      industry: profile.industry,
      description: profile.description,
      locations: profile.locations,
      serviceAreas: profile.serviceAreas,
      services: profile.services,
      products: profile.products,
    },
    audience: positioning.audience,
    valueProposition: positioning.valueProposition,
    brandVoice: positioning.brandVoice,
    suggestedGoals: positioning.suggestedGoals,
    evidence: profile.facts,
    inferences,
    confidence: { ...profile.confidence, ...positioning.confidence },
  };
}
