import { z } from 'zod';

import { CONTENT_GOALS, FACT_CATEGORIES, VOICE_TRAITS } from './types.js';

/**
 * Structured-output schemas for the two AI steps. Kept free of length/format
 * constraints so they're valid in strict JSON-schema mode; sanitizing happens
 * after validation (see verify.ts).
 */
const confidence = z.enum(['high', 'medium', 'low']);

const cited = z.object({
  value: z.string().describe('The item exactly as the website names it.'),
  pageIds: z.array(z.string()).describe('Ids of pages that state this, e.g. ["P2"].'),
  quote: z.string().describe('Short verbatim excerpt (under 25 words) from one of those pages that supports it.'),
});

/** Step 1 — facts only. Everything cited. */
export const ProfileExtractionSchema = z.object({
  businessName: cited.nullable(),
  industry: z.string().nullable().describe('Short plain-language category, e.g. "Mobile IV therapy". Null if unclear.'),
  description: z
    .string()
    .nullable()
    .describe('2–3 neutral sentences describing what the business does, using ONLY what the pages state.'),
  services: z.array(cited),
  products: z.array(cited),
  locations: z.array(cited).describe('Physical locations / addresses / home city explicitly stated.'),
  serviceAreas: z.array(cited).describe('Areas the site explicitly says it serves. Empty if not stated.'),
  facts: z
    .array(
      z.object({
        category: z.enum(FACT_CATEGORIES),
        statement: z.string().describe('The fact in your own words, no embellishment.'),
        pageIds: z.array(z.string()),
        quote: z.string(),
      }),
    )
    .describe('Other notable stated facts: differentiators, credentials, audience served, guarantees, process, pricing model, years in business.'),
  contentSufficiency: z.enum(['sufficient', 'limited', 'insufficient']),
  confidence: z.object({ name: confidence, industry: confidence, services: confidence, locations: confidence }),
});
export type ProfileExtraction = z.infer<typeof ProfileExtractionSchema>;

/** Step 2 — inferences, grounded in the verified facts from step 1. */
export const PositioningSchema = z.object({
  audience: z.object({
    summary: z.string().describe('2–3 plain sentences about the ideal customer, written for the owner to read.'),
    customerTypes: z.array(z.string()),
    needs: z.array(z.string()),
    painPoints: z.array(z.string()),
    motivations: z.array(z.string()),
    behaviors: z.array(z.string()),
    locations: z.array(z.string()),
    ageRanges: z.array(z.string()).describe('Only broad ranges and only when reasonably inferable; otherwise [].'),
    basedOnFactIds: z.array(z.string()),
  }),
  valueProposition: z.object({
    summary: z.string().describe('1–2 sentences: who it is for, what problem it solves, how, and why it is different.'),
    differentiators: z.array(z.object({ statement: z.string(), factIds: z.array(z.string()) })),
    problemsSolved: z.array(z.string()),
    benefits: z.array(z.string()),
    basedOnFactIds: z.array(z.string()),
  }),
  brandVoice: z.object({
    suggestedTraits: z.array(z.enum(VOICE_TRAITS)),
    observedTone: z.string().nullable(),
  }),
  suggestedGoals: z.array(z.enum(CONTENT_GOALS)),
  confidence: z.object({ audience: confidence, valueProposition: confidence }),
});
export type Positioning = z.infer<typeof PositioningSchema>;

type JsonSchema = Record<string, unknown>;

/**
 * zod → JSON schema suitable for strict structured output: every object lists
 * all properties as required and forbids extra properties.
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { target: 'draft-7', io: 'output', unrepresentable: 'any' }) as JsonSchema;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: JsonSchema = {};
    for (const [k, v] of Object.entries(node as JsonSchema)) {
      if (k === '$schema') continue;
      out[k] = walk(v);
    }
    if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
      out.required = Object.keys(out.properties as JsonSchema);
      out.additionalProperties = false;
    }
    return out;
  };
  return walk(raw) as JsonSchema;
}
