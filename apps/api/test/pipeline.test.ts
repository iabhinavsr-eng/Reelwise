import { describe, expect, it } from 'vitest';

import { runAnalysisPipeline, PipelineDeps } from '../src/analysis/pipeline.js';
import { AIProviderError } from '../src/analysis/providers/AIProvider.js';
import type { AnalysisDebug } from '../src/analysis/types.js';
import { FixtureFetcher } from './fixtures/FixtureFetcher.js';
import { parked, wellness } from './fixtures/sites.js';
import { StubAIProvider, wellnessAI, wellnessPositioning } from './fixtures/stubAI.js';

const deps = (fetcher: FixtureFetcher, ai: PipelineDeps['ai']): PipelineDeps => ({
  fetcher,
  ai,
  crawl: { maxPages: 15, maxDepth: 2, concurrency: 4, totalBudgetMs: 10_000 },
});
const newDebug = (): AnalysisDebug => ({ evidencePages: [], rejectedClaims: [], warnings: [], timings: {} });

describe('runAnalysisPipeline', () => {
  it('produces a sourced factual profile plus grounded inferences', async () => {
    const ai = wellnessAI();
    const debug = newDebug();
    const statuses: string[] = [];
    const result = await runAnalysisPipeline(
      { analysisId: 'a1', version: 1, url: 'lyteguards.com' },
      deps(new FixtureFetcher(wellness), ai),
      debug,
      { onStatus: (s, d) => void statuses.push(d.phase ? `${s}:${d.phase}` : s) },
    );

    expect(result.business.name?.value).toBe('Lyte Guards Mobile IV');
    expect(result.business.services.map((s) => s.value)).not.toContain('Botox injections');
    expect(result.business.services.every((s) => s.sources.every((u) => u.startsWith('https://www.lyteguards.com/')))).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(3);
    expect(result.inferences.map((i) => i.category)).toEqual(expect.arrayContaining(['industry', 'audience', 'value_proposition']));
    expect(result.audience.summary).toMatch(/Delaware/);
    expect(result.confidence).toMatchObject({ name: 'high', services: 'high' });

    // Progress is real: crawl first, then facts, then positioning.
    expect(statuses[0]).toBe('crawling');
    expect(statuses.slice(-2)).toEqual(['analyzing:profile', 'analyzing:positioning']);

    // The AI only ever sees extracted text — never raw HTML or scripts.
    const prompt = ai.calls[0].user;
    expect(prompt).not.toMatch(/<script|<div|track everything/);
    expect(ai.calls[0].system).toMatch(/untrusted data/);

    // Debug has what we need to tune.
    expect(debug.crawl?.pagesCrawled).toBeGreaterThan(4);
    expect(debug.rejectedClaims.map((r) => r.value)).toContain('Botox injections');
    expect(debug.timings.crawlMs).toBeGreaterThanOrEqual(0);
    expect(debug.model).toBe('stub:stub-1');
  });

  it('fails with insufficient_content on a near-empty site without calling the AI', async () => {
    const ai = wellnessAI();
    await expect(runAnalysisPipeline({ analysisId: 'a', version: 1, url: 'coming-soon-biz.com' }, deps(new FixtureFetcher(parked), ai), newDebug())).rejects.toMatchObject({
      code: 'insufficient_content',
    });
    expect(ai.calls).toHaveLength(0);
  });

  it('fails with insufficient_content when the AI can’t identify the business', async () => {
    const ai = new StubAIProvider({
      business_profile: () => ({
        businessName: null,
        industry: null,
        description: null,
        services: [],
        products: [],
        locations: [],
        serviceAreas: [],
        facts: [],
        contentSufficiency: 'insufficient',
        confidence: { name: 'low', industry: 'low', services: 'low', locations: 'low' },
      }),
    });
    await expect(runAnalysisPipeline({ analysisId: 'a', version: 1, url: 'lyteguards.com' }, deps(new FixtureFetcher(wellness), ai), newDebug())).rejects.toMatchObject({
      code: 'insufficient_content',
    });
  });

  it('maps AI failures to ai_failed / ai_invalid_output and keeps crawl debug', async () => {
    const failing = new StubAIProvider({
      business_profile: () => {
        throw new AIProviderError('request_failed', 'HTTP 500');
      },
    });
    const debug = newDebug();
    await expect(runAnalysisPipeline({ analysisId: 'a', version: 1, url: 'lyteguards.com' }, deps(new FixtureFetcher(wellness), failing), debug)).rejects.toMatchObject({
      code: 'ai_failed',
    });
    expect(debug.crawl?.pagesCrawled).toBeGreaterThan(0);

    const invalid = new StubAIProvider({ business_profile: () => ({ garbage: true }) });
    await expect(runAnalysisPipeline({ analysisId: 'a', version: 1, url: 'lyteguards.com' }, deps(new FixtureFetcher(wellness), invalid), newDebug())).rejects.toThrow();
  });

  it('reports ai_not_configured when no provider is set', async () => {
    await expect(runAnalysisPipeline({ analysisId: 'a', version: 1, url: 'lyteguards.com' }, deps(new FixtureFetcher(wellness), null), newDebug())).rejects.toMatchObject({
      code: 'ai_not_configured',
    });
  });

  it('manual fallback: uses the owner’s answers even when the site is unreachable', async () => {
    const ai = new StubAIProvider({
      business_profile: (req) => {
        expect(req.user).toContain('<page id="P0" url="owner-provided"');
        return {
          businessName: { value: 'Sunny Paws Grooming', pageIds: ['P0'], quote: 'Sunny Paws Grooming' },
          industry: 'Mobile pet grooming',
          description: 'Mobile dog grooming.',
          services: [{ value: 'Mobile dog grooming', pageIds: ['P0'], quote: 'mobile dog grooming van' }],
          products: [],
          locations: [],
          serviceAreas: [],
          facts: [],
          contentSufficiency: 'limited',
          confidence: { name: 'high', industry: 'medium', services: 'medium', locations: 'low' },
        };
      },
      business_positioning: () => wellnessPositioning(),
    });
    const result = await runAnalysisPipeline(
      {
        analysisId: 'a',
        version: 1,
        url: 'https://sunnypaws-offline.com',
        manual: { businessName: 'Sunny Paws Grooming', whatYouDo: 'We run a mobile dog grooming van.', customers: 'Busy dog owners' },
      },
      deps(new FixtureFetcher(), ai),
      newDebug(),
    );
    expect(result.mode).toBe('manual');
    expect(result.business.services[0]).toEqual({ value: 'Mobile dog grooming', sources: ['owner-provided'] });
  });
});
