import { describe, expect, it, vi } from 'vitest';

import { buildEvidence } from '../src/analysis/evidence.js';
import { AIProviderError } from '../src/analysis/providers/AIProvider.js';
import { OpenAIProvider } from '../src/analysis/providers/OpenAIProvider.js';
import { PositioningSchema, ProfileExtractionSchema, toStrictJsonSchema } from '../src/analysis/schema.js';
import { sanitizeAgeRanges, verifyPositioning, verifyProfile, Rejected } from '../src/analysis/verify.js';
import { crawlWebsite } from '../src/crawler/crawl.js';
import { FixtureFetcher } from './fixtures/FixtureFetcher.js';
import { wellness } from './fixtures/sites.js';
import { wellnessPositioning, wellnessProfile } from './fixtures/stubAI.js';

describe('structured output schemas', () => {
  it.each([
    ['profile', ProfileExtractionSchema],
    ['positioning', PositioningSchema],
  ])('%s schema is strict-mode compatible (all objects closed, all keys required)', (_name, schema) => {
    const json = toStrictJsonSchema(schema);
    const visit = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      expect(n).not.toHaveProperty('$schema');
      if (n.type === 'object') {
        expect(n.additionalProperties).toBe(false);
        expect(new Set(n.required as string[])).toEqual(new Set(Object.keys(n.properties as object)));
      }
      Object.values(n).forEach(visit);
    };
    visit(json);
  });

  it('rejects malformed AI output', () => {
    expect(ProfileExtractionSchema.safeParse({ businessName: 'x' }).success).toBe(false);
    const bad = { ...wellnessPositioning(), brandVoice: { suggestedTraits: ['sarcastic'], observedTone: null } };
    expect(PositioningSchema.safeParse(bad).success).toBe(false);
    expect(PositioningSchema.safeParse(wellnessPositioning()).success).toBe(true);
  });
});

describe('verification guardrails', async () => {
  const crawl = await crawlWebsite('https://www.lyteguards.com', {
    fetcher: new FixtureFetcher(wellness),
    maxPages: 15,
    maxDepth: 2,
    concurrency: 4,
    totalBudgetMs: 10_000,
  });
  const evidence = buildEvidence(crawl);
  const rejected: Rejected[] = [];
  const profile = verifyProfile(wellnessProfile(evidence.pages), evidence, rejected);

  it('keeps cited services with real source URLs', () => {
    const services = profile.services.map((s) => s.value);
    expect(services).toEqual(['Mobile IV therapy', 'Myers’ Cocktail', 'NAD+ therapy']);
    expect(profile.services[0].sources).toEqual(['https://www.lyteguards.com/mobile-iv']);
  });

  it('drops hallucinated services and claims citing unknown pages', () => {
    expect(profile.services.map((s) => s.value)).not.toContain('Botox injections');
    expect(profile.services.map((s) => s.value)).not.toContain('Hydration drip');
    expect(rejected.map((r) => r.value)).toEqual(expect.arrayContaining(['Botox injections', 'Hydration drip']));
  });

  it('never keeps an inferred service area', () => {
    expect(profile.serviceAreas.map((s) => s.value)).toEqual(['New Castle County']);
    expect(rejected.some((r) => r.value === 'Philadelphia')).toBe(true);
  });

  it('only keeps facts whose quote is on the page, and numbers them', () => {
    const statements = profile.facts.map((f) => f.statement);
    expect(statements).toContain('IVs are administered by Delaware-licensed registered nurses');
    expect(statements).not.toContain('Voted best in Delaware 2024');
    expect(profile.facts.map((f) => f.id)).toEqual(profile.facts.map((_, i) => `F${i + 1}`));
    expect(profile.facts.every((f) => f.sources.length > 0)).toBe(true);
  });

  it('inferences: drops unsupported differentiators, fake precision, and unknown fact ids', () => {
    const r2: Rejected[] = [];
    // Re-point the stub's fact ids at real facts.
    const raw = wellnessPositioning();
    const homeFact = profile.facts.find((f) => f.category === 'differentiator')!.id;
    raw.valueProposition.differentiators[0].factIds = [homeFact];
    const pos = verifyPositioning(raw, profile.facts, r2);
    expect(pos.valueProposition.differentiators.map((d) => d.value)).toEqual(['Comes to your home, office or hotel']);
    expect(pos.valueProposition.differentiators[0].sources.length).toBeGreaterThan(0);
    expect(r2.some((r) => r.value === 'Award-winning care')).toBe(true);
    expect(pos.audience.ageRanges).toEqual(['30s–50s']);
    expect(pos.inferences.find((i) => i.category === 'audience')!.basedOn.every((id) => profile.facts.some((f) => f.id === id))).toBe(true);
  });

  it('flags generic value-proposition filler not found on the site', () => {
    const raw = wellnessPositioning();
    raw.valueProposition.summary = 'We provide high-quality, customer-focused personalized solutions.';
    const pos = verifyPositioning(raw, profile.facts, []);
    expect(pos.warnings.join(' ')).toMatch(/high-quality/);
    expect(pos.confidence.valueProposition).toBe('medium'); // generic filler caps confidence
  });

  it('sanitizeAgeRanges removes incomes and over-precise bands', () => {
    expect(sanitizeAgeRanges(['25–45', '30s–50s', '37–52', '41-44', '$90k+', 'Income 100k'], [])).toEqual(['25–45', '30s–50s']);
  });
});

describe('OpenAIProvider', () => {
  const okBody = (content: unknown) => ({
    model: 'gpt-test',
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
  const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const request = { name: 'business_positioning', system: 'sys', user: 'usr', schema: PositioningSchema };

  it('sends a strict json_schema request with the key server-side and parses the result', async () => {
    const fetchImpl = vi.fn(async () => response(200, okBody(wellnessPositioning())));
    const provider = new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-test', fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await provider.generateStructured(request);
    expect(res.data.brandVoice.suggestedTraits).toEqual(['warm', 'conversational']);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body).not.toHaveProperty('temperature');
  });

  it('retries once on 5xx, then succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(503, { error: { message: 'overloaded' } })).mockResolvedValueOnce(response(200, okBody(wellnessPositioning())));
    const provider = new OpenAIProvider({ apiKey: 'k', model: 'm', fetchImpl });
    await expect(provider.generateStructured(request)).resolves.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(400, { error: { message: 'bad model' } }));
    const provider = new OpenAIProvider({ apiKey: 'k', model: 'm', fetchImpl });
    await expect(provider.generateStructured(request)).rejects.toMatchObject({ kind: 'request_failed' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('asks the model to repair invalid output once, then gives up', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, okBody({ nope: true })));
    const provider = new OpenAIProvider({ apiKey: 'k', model: 'm', fetchImpl });
    await expect(provider.generateStructured(request)).rejects.toMatchObject({ kind: 'invalid_output' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const second = JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string);
    expect(second.messages.at(-1).content).toMatch(/did not match the schema/);
  });

  it('surfaces refusals and truncated output', async () => {
    const refusal = vi.fn().mockResolvedValue(response(200, { choices: [{ message: { refusal: 'no' } }] }));
    await expect(new OpenAIProvider({ apiKey: 'k', model: 'm', fetchImpl: refusal }).generateStructured(request)).rejects.toMatchObject({ kind: 'refused' });
    const cut = vi.fn().mockResolvedValue(response(200, { choices: [{ finish_reason: 'length', message: { content: '{"aud' } }] }));
    await expect(new OpenAIProvider({ apiKey: 'k', model: 'm', fetchImpl: cut }).generateStructured(request)).rejects.toMatchObject({ kind: 'invalid_output' });
  });

  it('requires an API key', () => {
    expect(() => new OpenAIProvider({ apiKey: '', model: 'm' })).toThrow(AIProviderError);
  });
});
