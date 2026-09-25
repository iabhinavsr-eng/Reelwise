import { EvidencePage, WebsiteEvidence } from './evidence.js';
import type { Positioning, ProfileExtraction } from './schema.js';
import type { Confidence, Fact, FactCategory, Inference, SourcedValue } from './types.js';

/**
 * Server-side guardrails. The model is asked to cite, but we check:
 * - cited page ids must exist,
 * - the quote (or the item's own name) must actually appear on a cited page.
 * Anything that fails is dropped from the factual profile and recorded in
 * `rejected` for the debug view. Inferences must reference real facts.
 */
export interface Rejected {
  kind: string;
  value: string;
  reason: string;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const STOP = new Set(['the', 'and', 'for', 'our', 'you', 'your', 'with', 'are', 'from', 'that', 'this', 'we', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'is', 'or', 'by', 'it']);

function tokens(s: string): string[] {
  return normalizeText(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function pageText(p: EvidencePage): string {
  return normalizeText(
    [p.title, p.metaDescription, p.h1, ...p.headings, p.content, p.structuredData.length ? JSON.stringify(p.structuredData) : '']
      .filter(Boolean)
      .join(' '),
  );
}

export class EvidenceIndex {
  private readonly byId = new Map<string, { page: EvidencePage; text: string; tokens: Set<string> }>();

  constructor(evidence: WebsiteEvidence) {
    for (const page of evidence.pages) {
      const text = pageText(page);
      this.byId.set(page.id, { page, text, tokens: new Set(text.split(' ')) });
    }
  }

  url(pageId: string) {
    return this.byId.get(pageId)?.page.url;
  }

  /** Is `quote` (or failing that, `value`) supported by any of the cited pages? Returns supporting page ids. */
  supportingPages(pageIds: string[], quote: string, value?: string): string[] {
    const valid = [...new Set(pageIds.map((id) => id.trim().toUpperCase()))].filter((id) => this.byId.has(id));
    const nq = normalizeText(quote);
    const qTokens = tokens(quote);
    const vTokens = value ? tokens(value) : [];
    const nv = value ? normalizeText(value) : '';
    return valid.filter((id) => {
      const entry = this.byId.get(id)!;
      if (nq.length >= 4 && entry.text.includes(nq)) return true;
      // Tolerate small paraphrases: ≥ 85% of the quote's meaningful words on the page.
      if (qTokens.length >= 3 && qTokens.filter((t) => entry.tokens.has(t)).length / qTokens.length >= 0.85) return true;
      // Or the item's own name appears on the page.
      if (nv.length >= 3 && entry.text.includes(nv)) return true;
      if (vTokens.length >= 2 && vTokens.every((t) => entry.tokens.has(t))) return true;
      return false;
    });
  }
}

export interface VerifiedProfile {
  name: SourcedValue | null;
  industry: string | null;
  description: string | null;
  services: SourcedValue[];
  products: SourcedValue[];
  locations: SourcedValue[];
  serviceAreas: SourcedValue[];
  facts: Fact[];
  confidence: ProfileExtraction['confidence'];
  contentSufficiency: ProfileExtraction['contentSufficiency'];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s).trim();

export function verifyProfile(raw: ProfileExtraction, evidence: WebsiteEvidence, rejected: Rejected[]): VerifiedProfile {
  const index = new EvidenceIndex(evidence);
  const facts: Fact[] = [];
  const addFact = (category: FactCategory, statement: string, quote: string, sources: string[]) => {
    const key = normalizeText(statement);
    if (facts.some((f) => normalizeText(f.statement) === key)) return;
    facts.push({ id: `F${facts.length + 1}`, category, statement: clip(statement, 300), quote: clip(quote, 300), sources });
  };

  const verifyList = (items: ProfileExtraction['services'], kind: string, category: FactCategory, max: number): SourcedValue[] => {
    const out: SourcedValue[] = [];
    for (const item of items) {
      const value = clip(item.value.trim(), 120);
      if (!value) continue;
      if (out.some((o) => normalizeText(o.value) === normalizeText(value))) continue;
      const pages = index.supportingPages(item.pageIds, item.quote, value);
      if (!pages.length) {
        rejected.push({ kind, value, reason: item.pageIds.length ? 'not found on cited page' : 'no source cited' });
        continue;
      }
      const sources = pages.map((id) => index.url(id)!);
      out.push({ value, sources });
      addFact(category, `${kind === 'service' ? 'Offers' : kind === 'product' ? 'Sells' : kind === 'location' ? 'Located in' : 'Serves'} ${value}`, item.quote, sources);
      if (out.length >= max) break;
    }
    return out;
  };

  let name: SourcedValue | null = null;
  if (raw.businessName?.value.trim()) {
    const pages = index.supportingPages(raw.businessName.pageIds, raw.businessName.quote, raw.businessName.value);
    if (pages.length) {
      name = { value: clip(raw.businessName.value.trim(), 120), sources: pages.map((id) => index.url(id)!) };
      addFact('identity', `Business name: ${name.value}`, raw.businessName.quote, name.sources);
    } else {
      rejected.push({ kind: 'businessName', value: raw.businessName.value, reason: 'not found on cited page' });
    }
  }
  // Fallback: a name declared in the site's own metadata is still a stated fact.
  if (!name && evidence.siteNameHints.length) {
    name = { value: evidence.siteNameHints[0], sources: [evidence.pages.find((p) => p.id !== 'P0')?.url ?? evidence.websiteUrl] };
  }

  const services = verifyList(raw.services, 'service', 'service', 15);
  const products = verifyList(raw.products, 'product', 'product', 15);
  const locations = verifyList(raw.locations, 'location', 'location', 8);
  const serviceAreas = verifyList(raw.serviceAreas, 'service area', 'service_area', 15);

  for (const fact of raw.facts) {
    const pages = index.supportingPages(fact.pageIds, fact.quote);
    if (!pages.length) {
      rejected.push({ kind: `fact:${fact.category}`, value: fact.statement, reason: 'quote not found on cited page' });
      continue;
    }
    addFact(fact.category, fact.statement, fact.quote, pages.map((id) => index.url(id)!));
    if (facts.length >= 60) break;
  }

  const lowered = (c: Confidence, has: boolean): Confidence => (has ? c : 'low');
  return {
    name,
    industry: raw.industry?.trim() ? clip(raw.industry.trim(), 80) : null,
    description: raw.description?.trim() ? clip(raw.description.trim(), 600) : null,
    services,
    products,
    locations,
    serviceAreas,
    facts,
    contentSufficiency: raw.contentSufficiency,
    confidence: {
      name: name ? raw.confidence.name : 'low',
      industry: raw.industry ? raw.confidence.industry : 'low',
      services: lowered(raw.confidence.services, services.length + products.length > 0),
      locations: lowered(raw.confidence.locations, locations.length + serviceAreas.length > 0),
    },
  };
}

const GENERIC_PHRASES = [
  'high quality',
  'high-quality',
  'customer focused',
  'customer-focused',
  'personalized solutions',
  'top notch',
  'top-notch',
  'one stop shop',
  'one-stop shop',
  'best in class',
  'best-in-class',
  'second to none',
  'world class',
  'world-class',
  'exceptional service',
  'unparalleled',
  'cutting edge',
  'cutting-edge',
];

/** Drops fake precision: narrow age bands, incomes, money, percentages. */
export function sanitizeAgeRanges(ranges: string[], rejected: Rejected[]): string[] {
  return ranges
    .map((r) => r.trim())
    .filter((r) => {
      if (!r) return false;
      if (/[$€£%]|income|salary|k\b/i.test(r)) {
        rejected.push({ kind: 'ageRange', value: r, reason: 'contains income/money/percentage' });
        return false;
      }
      const nums = r.match(/\d+/g)?.map(Number) ?? [];
      // "30s–50s" or "25–45" read as honest estimates; "37–52" or "41–44" are fake precision.
      const oddEndpoints = nums.some((n) => n % 5 !== 0);
      const narrow = nums.length >= 2 && Math.abs(nums[1] - nums[0]) < 10;
      if (nums.length && (oddEndpoints || narrow)) {
        rejected.push({ kind: 'ageRange', value: r, reason: 'too precise' });
        return false;
      }
      return true;
    })
    .slice(0, 3);
}

function cleanList(list: string[], max: number, rejected: Rejected[], kind: string): string[] {
  const out: string[] = [];
  for (const item of list) {
    const v = clip(item.trim(), 160);
    if (!v) continue;
    if (/\$\s?\d|\d+(\.\d+)?\s?%|\bincome\b/i.test(v)) {
      rejected.push({ kind, value: v, reason: 'fake precision (money/percentages)' });
      continue;
    }
    if (!out.some((o) => normalizeText(o) === normalizeText(v))) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export interface VerifiedPositioning {
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
  brandVoice: Positioning['brandVoice'];
  suggestedGoals: Positioning['suggestedGoals'];
  inferences: Inference[];
  confidence: Positioning['confidence'];
  warnings: string[];
}

export function verifyPositioning(raw: Positioning, facts: Fact[], rejected: Rejected[]): VerifiedPositioning {
  const byId = new Map(facts.map((f) => [f.id.toUpperCase(), f]));
  const validIds = (ids: string[]) => [...new Set(ids.map((i) => i.trim().toUpperCase()))].filter((i) => byId.has(i));
  const warnings: string[] = [];

  const differentiators: SourcedValue[] = [];
  for (const d of raw.valueProposition.differentiators) {
    const ids = validIds(d.factIds);
    if (!ids.length) {
      rejected.push({ kind: 'differentiator', value: d.statement, reason: 'not backed by a verified fact' });
      continue;
    }
    differentiators.push({ value: clip(d.statement, 200), sources: [...new Set(ids.flatMap((id) => byId.get(id)!.sources))] });
    if (differentiators.length >= 6) break;
  }

  const factText = normalizeText(facts.map((f) => `${f.statement} ${f.quote}`).join(' '));
  for (const phrase of GENERIC_PHRASES) {
    const np = normalizeText(phrase);
    if (normalizeText(raw.valueProposition.summary).includes(np) && !factText.includes(np)) {
      warnings.push(`Value proposition uses generic phrase "${phrase}" not found on the website.`);
    }
  }

  const inferences: Inference[] = [];
  const addInference = (category: Inference['category'], statement: string, basedOn: string[]) => {
    if (statement.trim()) inferences.push({ id: `I${inferences.length + 1}`, category, statement: clip(statement, 400), basedOn: validIds(basedOn) });
  };
  addInference('audience', raw.audience.summary, raw.audience.basedOnFactIds);
  addInference('value_proposition', raw.valueProposition.summary, raw.valueProposition.basedOnFactIds);
  for (const d of differentiators) addInference('value_proposition', d.value, []);
  if (raw.brandVoice.suggestedTraits.length) addInference('voice', `Suggested voice: ${raw.brandVoice.suggestedTraits.join(', ')}`, []);

  let confidence = raw.confidence;
  if (!validIds(raw.audience.basedOnFactIds).length && confidence.audience === 'high') {
    confidence = { ...confidence, audience: 'medium' };
    warnings.push('Audience cites no verified facts; confidence lowered.');
  }
  if (warnings.some((w) => w.includes('generic phrase')) && confidence.valueProposition === 'high') {
    confidence = { ...confidence, valueProposition: 'medium' };
  }
  if (!differentiators.length && confidence.valueProposition === 'high') {
    confidence = { ...confidence, valueProposition: 'medium' };
    warnings.push('No evidence-backed differentiators; value proposition confidence lowered.');
  }

  return {
    audience: {
      summary: clip(raw.audience.summary.trim(), 700),
      customerTypes: cleanList(raw.audience.customerTypes, 6, rejected, 'customerType'),
      needs: cleanList(raw.audience.needs, 8, rejected, 'need'),
      painPoints: cleanList(raw.audience.painPoints, 8, rejected, 'painPoint'),
      motivations: cleanList(raw.audience.motivations, 6, rejected, 'motivation'),
      behaviors: cleanList(raw.audience.behaviors, 6, rejected, 'behavior'),
      locations: cleanList(raw.audience.locations, 6, rejected, 'audienceLocation'),
      ageRanges: sanitizeAgeRanges(raw.audience.ageRanges, rejected),
    },
    valueProposition: {
      summary: clip(raw.valueProposition.summary.trim(), 500),
      differentiators,
      problemsSolved: cleanList(raw.valueProposition.problemsSolved, 6, rejected, 'problemSolved'),
      benefits: cleanList(raw.valueProposition.benefits, 6, rejected, 'benefit'),
    },
    brandVoice: { suggestedTraits: [...new Set(raw.brandVoice.suggestedTraits)].slice(0, 3), observedTone: raw.brandVoice.observedTone },
    suggestedGoals: [...new Set(raw.suggestedGoals)].slice(0, 3),
    inferences,
    confidence,
    warnings,
  };
}
