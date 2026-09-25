import type { z } from 'zod';

/**
 * Vendor-neutral structured-generation interface. The pipeline only knows
 * this; OpenAIProvider is one implementation. Adding Anthropic, Gemini, a
 * local model, etc. means implementing `generateStructured` once.
 */
export interface StructuredRequest<T> {
  /** Stable name for the schema (used by providers that need one). */
  name: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
}

export interface StructuredResponse<T> {
  data: T;
  raw: unknown;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResponse<T>>;
}

export class AIProviderError extends Error {
  constructor(
    readonly kind: 'not_configured' | 'request_failed' | 'refused' | 'invalid_output' | 'timeout',
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
