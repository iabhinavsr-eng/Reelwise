import { Agent, fetch as undiciFetch } from 'undici';

import { AnalysisError } from './errors.js';
import { assertPublicUrl, safeLookup } from './ssrf.js';

export interface FetchResult {
  requestedUrl: string;
  /** URL after redirects. */
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  redirects: string[];
}

export interface FetchOptions {
  /** Allow redirects to another site (only for the very first request). */
  allowCrossSiteRedirect?: boolean;
  /** Accept non-HTML bodies (robots.txt, sitemaps). */
  accept?: 'html' | 'text' | 'xml';
}

/** Anything that can fetch a URL for the crawler. Tests inject a fixture fetcher. */
export interface Fetcher {
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
}

export class FetchFailure extends Error {
  constructor(
    readonly kind: 'network' | 'timeout' | 'blocked' | 'http' | 'too_large' | 'not_html' | 'redirect' | 'unsafe',
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FetchFailure';
  }
}

export interface SafeFetcherOptions {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
  retries?: number;
  userAgent?: string;
}

export const USER_AGENT = 'Mozilla/5.0 (compatible; ReelwiseBot/0.2; +https://reelwise.app/bot)';

/**
 * Production fetcher: SSRF-safe DNS at connect time, manual redirects with
 * re-validation, per-request timeout, response size cap, one retry on
 * transient failures. Never sends cookies or credentials.
 */
export class SafeFetcher implements Fetcher {
  private readonly agent: Agent;

  constructor(private readonly opts: SafeFetcherOptions) {
    this.agent = new Agent({
      connect: { lookup: safeLookup as never, timeout: Math.min(opts.timeoutMs, 8000) },
      headersTimeout: opts.timeoutMs,
      bodyTimeout: opts.timeoutMs,
      connections: 8,
    });
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const retries = this.opts.retries ?? 1;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.fetchOnce(url, options);
      } catch (e) {
        lastError = e;
        const transient =
          e instanceof FetchFailure && (e.kind === 'network' || e.kind === 'timeout' || (e.kind === 'http' && (e.status ?? 0) >= 500));
        if (!transient || attempt === retries) break;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  private async fetchOnce(url: string, options: FetchOptions): Promise<FetchResult> {
    const maxRedirects = this.opts.maxRedirects ?? 5;
    const redirects: string[] = [];
    let current = new URL(url);
    const origin = new URL(url);

    for (let hop = 0; hop <= maxRedirects; hop++) {
      try {
        assertPublicUrl(current);
      } catch (e) {
        throw new FetchFailure('unsafe', e instanceof Error ? e.message : 'Unsafe URL');
      }

      let res;
      try {
        res = await undiciFetch(current, {
          dispatcher: this.agent,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.opts.timeoutMs),
          headers: {
            'user-agent': this.opts.userAgent ?? USER_AGENT,
            accept:
              options.accept === 'xml'
                ? 'application/xml,text/xml;q=0.9,*/*;q=0.5'
                : options.accept === 'text'
                  ? 'text/plain,*/*;q=0.5'
                  : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
            'accept-language': 'en;q=1.0,*;q=0.5',
          },
        });
      } catch (e) {
        const err = e as Error & { cause?: { code?: string } };
        if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new FetchFailure('timeout', `Timed out fetching ${current}`);
        if (err.cause?.code === 'EBLOCKEDADDRESS') throw new FetchFailure('unsafe', `Blocked private address for ${current.hostname}`);
        throw new FetchFailure('network', `Could not connect to ${current.hostname}: ${err.cause?.code ?? err.message}`);
      }

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        await res.body?.cancel().catch(() => {});
        const next = new URL(res.headers.get('location')!, current);
        next.hash = '';
        const sameSite = next.hostname.replace(/^www\./, '') === origin.hostname.replace(/^www\./, '');
        if (!sameSite && !options.allowCrossSiteRedirect) {
          throw new FetchFailure('redirect', `Redirected off-site to ${next.hostname}`);
        }
        redirects.push(next.toString());
        current = next;
        continue;
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (res.status >= 400) {
        await res.body?.cancel().catch(() => {});
        const kind = [401, 403, 429, 451].includes(res.status) ? 'blocked' : 'http';
        throw new FetchFailure(kind, `HTTP ${res.status} for ${current}`, res.status);
      }
      if ((options.accept ?? 'html') === 'html' && contentType && !/html|xml/i.test(contentType)) {
        await res.body?.cancel().catch(() => {});
        throw new FetchFailure('not_html', `Not an HTML page (${contentType})`);
      }

      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > this.opts.maxBytes) {
        await res.body?.cancel().catch(() => {});
        throw new FetchFailure('too_large', `Response too large (${declared} bytes)`);
      }
      const body = await readLimited(res.body as ReadableStream<Uint8Array> | null, this.opts.maxBytes, charsetOf(contentType));
      return { requestedUrl: url, finalUrl: current.toString(), status: res.status, contentType, body, redirects };
    }
    throw new FetchFailure('redirect', 'Too many redirects');
  }
}

function charsetOf(contentType: string): string {
  const m = contentType.match(/charset=["']?([\w-]+)/i);
  try {
    return m ? new TextDecoder(m[1]).encoding : 'utf-8';
  } catch {
    return 'utf-8';
  }
}

/** Reads a body stream, stopping (not failing) once maxBytes is reached. */
async function readLimited(body: ReadableStream<Uint8Array> | null, maxBytes: number, charset: string): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - total;
    if (value.byteLength >= remaining) {
      chunks.push(value.subarray(0, remaining));
      total = maxBytes;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder(charset, { fatal: false }).decode(merged);
}

/** Maps low-level fetch failures on the homepage to a pipeline error. */
export function homepageError(e: unknown): AnalysisError {
  if (e instanceof AnalysisError) return e;
  if (e instanceof FetchFailure) {
    switch (e.kind) {
      case 'unsafe':
        return new AnalysisError('unsafe_url', 'That address isn’t a public website.', e.message);
      case 'blocked':
        return new AnalysisError('crawl_blocked', 'The website blocked our request.', e.message);
      case 'not_html':
        return new AnalysisError('not_html', 'That address isn’t a web page we can read.', e.message);
      case 'timeout':
        return new AnalysisError('site_unreachable', 'The website took too long to respond.', e.message);
      default:
        return new AnalysisError('site_unreachable', 'We couldn’t reach that website.', e.message);
    }
  }
  return new AnalysisError('site_unreachable', 'We couldn’t reach that website.', e instanceof Error ? e.message : String(e));
}
