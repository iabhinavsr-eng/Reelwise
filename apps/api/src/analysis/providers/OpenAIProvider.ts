import { toStrictJsonSchema } from '../schema.js';
import { AIProvider, AIProviderError, StructuredRequest, StructuredResponse } from './AIProvider.js';

export interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  timeoutMs?: number;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
}

interface ChatCompletion {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/**
 * OpenAI Chat Completions with strict JSON-schema structured output. Output
 * is additionally validated with zod — we never trust shape blindly.
 * Retries once on transient HTTP errors and once on invalid output.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: OpenAIProviderOptions) {
    if (!opts.apiKey) throw new AIProviderError('not_configured', 'OPENAI_API_KEY is not set.');
    this.model = opts.model;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const jsonSchema = toStrictJsonSchema(req.schema);
    let lastError: AIProviderError | null = null;
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ];

    for (let attempt = 0; attempt < 3; attempt++) {
      let completion: ChatCompletion;
      try {
        completion = await this.request(messages, req.name, jsonSchema, req.signal);
      } catch (e) {
        lastError = e instanceof AIProviderError ? e : new AIProviderError('request_failed', String(e));
        const status = (lastError.detail as { status?: number } | undefined)?.status;
        const retryable = lastError.kind === 'request_failed' && (status === undefined || status === 429 || status >= 500);
        if (retryable && attempt < 1) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        throw lastError;
      }

      const choice = completion.choices?.[0];
      if (choice?.message?.refusal) throw new AIProviderError('refused', 'The model declined to analyze this content.', choice.message.refusal);
      const content = choice?.message?.content;
      if (choice?.finish_reason === 'length') {
        lastError = new AIProviderError('invalid_output', 'Model output was cut off.');
      } else if (!content) {
        lastError = new AIProviderError('invalid_output', 'Model returned no content.');
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          lastError = new AIProviderError('invalid_output', 'Model returned malformed JSON.', content.slice(0, 500));
          parsed = undefined;
        }
        if (parsed !== undefined) {
          const result = req.schema.safeParse(parsed);
          if (result.success) {
            return {
              data: result.data,
              raw: parsed,
              model: completion.model ?? this.model,
              usage: { inputTokens: completion.usage?.prompt_tokens, outputTokens: completion.usage?.completion_tokens },
            };
          }
          lastError = new AIProviderError('invalid_output', 'Model output failed validation.', result.error.issues.slice(0, 5));
          // Give the model one chance to repair its own output.
          messages.push({ role: 'assistant', content }, { role: 'user', content: `That JSON did not match the schema: ${JSON.stringify(result.error.issues.slice(0, 5))}. Return corrected JSON only.` });
        }
      }
      if (attempt >= 1) break;
    }
    throw lastError ?? new AIProviderError('invalid_output', 'Model output was invalid.');
  }

  private async request(
    messages: { role: string; content: string }[],
    name: string,
    schema: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ChatCompletion> {
    const timeout = AbortSignal.timeout(this.opts.timeoutMs ?? 90_000);
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    };
    if (this.opts.temperature !== undefined) body.temperature = this.opts.temperature;

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.opts.apiKey}` },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      const err = e as Error;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new AIProviderError('timeout', 'The AI request timed out.');
      throw new AIProviderError('request_failed', `AI request failed: ${err.message}`);
    }
    const json = (await res.json().catch(() => ({}))) as ChatCompletion;
    if (!res.ok) {
      // Only 429/5xx are retried by the caller; other 4xx won't fix themselves.
      throw new AIProviderError('request_failed', `AI request failed (HTTP ${res.status}): ${json.error?.message ?? 'unknown error'}`, {
        status: res.status,
      });
    }
    return json;
  }
}
