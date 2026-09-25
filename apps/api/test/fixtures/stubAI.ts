import type { AIProvider, StructuredRequest, StructuredResponse } from '../../src/analysis/providers/AIProvider.js';
import type { Positioning, ProfileExtraction } from '../../src/analysis/schema.js';

type Handler = (req: StructuredRequest<unknown>) => unknown;

/** Deterministic AIProvider for tests; responses validated through the real zod schemas. */
export class StubAIProvider implements AIProvider {
  readonly name = 'stub';
  readonly model = 'stub-1';
  readonly calls: StructuredRequest<unknown>[] = [];

  constructor(private readonly handlers: Record<string, Handler>) {}

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    this.calls.push(req as StructuredRequest<unknown>);
    const handler = this.handlers[req.name];
    if (!handler) throw new Error(`No stub for ${req.name}`);
    const raw = handler(req as StructuredRequest<unknown>);
    return { data: req.schema.parse(raw), raw, model: this.model, usage: { inputTokens: 100, outputTokens: 50 } };
  }
}

/** What a well-behaved model would return for the wellness fixture — plus two bad claims. */
export const wellnessProfile = (evidencePages: { id: string; url: string }[]): ProfileExtraction => {
  const id = (path: string) => evidencePages.find((p) => new URL(p.url).pathname === path)?.id ?? 'P1';
  return {
    businessName: { value: 'Lyte Guards Mobile IV', pageIds: [id('/')], quote: 'Lyte Guards Mobile IV' },
    industry: 'Mobile IV therapy',
    description: 'Registered nurses deliver IV hydration and vitamin therapy to homes, offices and hotels in northern Delaware.',
    services: [
      { value: 'Mobile IV therapy', pageIds: [id('/mobile-iv')], quote: 'We offer mobile IV therapy anywhere in New Castle County' },
      { value: 'Myers’ Cocktail', pageIds: [id('/services')], quote: 'Myers’ Cocktail' },
      { value: 'NAD+ therapy', pageIds: [id('/services')], quote: 'NAD+ therapy' },
      // Hallucinated — appears nowhere on the site:
      { value: 'Botox injections', pageIds: [id('/services')], quote: 'Botox injections for smooth skin' },
      // Cites a page id that doesn't exist:
      { value: 'Hydration drip', pageIds: ['P99'], quote: 'Hydration drip' },
    ],
    products: [],
    locations: [{ value: 'Wilmington, Delaware', pageIds: [id('/')], quote: 'Serving Wilmington, Newark and Middletown, Delaware' }],
    serviceAreas: [
      { value: 'New Castle County', pageIds: [id('/mobile-iv')], quote: 'anywhere in New Castle County' },
      // Inferred, not stated:
      { value: 'Philadelphia', pageIds: [id('/')], quote: 'We serve the greater Philadelphia area' },
    ],
    facts: [
      { category: 'differentiator', statement: 'Nurses come to the customer’s home, office or hotel', pageIds: [id('/')], quote: 'bring IV hydration and vitamin therapy to your home, office or hotel' },
      { category: 'credential', statement: 'IVs are administered by Delaware-licensed registered nurses', pageIds: [id('/faq')], quote: 'administered by a Delaware-licensed registered nurse' },
      { category: 'pricing', statement: 'Drips start at $149', pageIds: [id('/pricing')], quote: 'Drips start at $149' },
      { category: 'other', statement: 'Voted best in Delaware 2024', pageIds: [id('/')], quote: 'Voted best IV clinic in Delaware 2024' },
    ],
    contentSufficiency: 'sufficient',
    confidence: { name: 'high', industry: 'high', services: 'high', locations: 'medium' },
  };
};

export const wellnessPositioning = (): Positioning => ({
  audience: {
    summary: 'Busy professionals and active adults in northern Delaware who want to feel better fast without leaving home or work.',
    customerTypes: ['Busy professionals', 'Event groups'],
    needs: ['Fast rehydration', 'Convenience'],
    painPoints: ['No time to visit a clinic'],
    motivations: ['Recover quickly'],
    behaviors: ['Books on short notice'],
    locations: ['Wilmington', 'Newark'],
    ageRanges: ['30s–50s', '37–52', 'Income $94,000+'],
    basedOnFactIds: ['F1', 'F6', 'F99'],
  },
  valueProposition: {
    summary: 'For busy people in northern Delaware, Lyte Guards brings nurse-administered IV therapy to your door, so you can recover without a clinic visit.',
    differentiators: [
      { statement: 'Comes to your home, office or hotel', factIds: ['F6'] },
      { statement: 'Award-winning care', factIds: [] },
    ],
    problemsSolved: ['Dehydration after illness or travel'],
    benefits: ['Recover at home'],
    basedOnFactIds: ['F6', 'F7'],
  },
  brandVoice: { suggestedTraits: ['warm', 'conversational'], observedTone: 'Friendly and reassuring' },
  suggestedGoals: ['educate', 'build_trust'],
  confidence: { audience: 'medium', valueProposition: 'high' },
});

const pagesFromPrompt = (user: string) => [...user.matchAll(/<page id="(P\d+)" url="([^"]+)"/g)].map((m) => ({ id: m[1], url: m[2] }));

/** Stub that answers like a good model for the wellness fixture site. */
export const wellnessAI = () =>
  new StubAIProvider({
    business_profile: (req) => wellnessProfile(pagesFromPrompt(req.user)),
    business_positioning: () => wellnessPositioning(),
  });
