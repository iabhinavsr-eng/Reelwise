import { Fetcher, FetchFailure, FetchOptions, FetchResult } from '../../src/crawler/fetcher.js';
import type { FixtureSite } from './sites.js';

/**
 * In-memory Fetcher backed by fixture sites. Mirrors SafeFetcher semantics:
 * manual redirects, off-site redirect refusal, blocked/HTTP errors, non-HTML.
 * Records every URL requested so tests can assert what was (not) fetched.
 */
export class FixtureFetcher implements Fetcher {
  readonly requested: string[] = [];
  private readonly responses = new Map<string, FixtureSite['responses'][string]>();

  constructor(...sites: FixtureSite[]) {
    for (const site of sites) for (const [url, res] of Object.entries(site.responses)) this.responses.set(url, res);
  }

  private lookup(url: URL) {
    const exact = this.responses.get(url.toString());
    if (exact) return exact;
    // Trailing-slash tolerant, like most servers.
    const alt = url.pathname.endsWith('/') && url.pathname !== '/' ? url.toString().replace(/\/(\?|$)/, '$1') : null;
    return alt ? this.responses.get(alt) : undefined;
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    this.requested.push(url);
    const origin = new URL(url);
    let current = new URL(url);
    const redirects: string[] = [];
    for (let hop = 0; hop < 5; hop++) {
      const res = this.lookup(current);
      if (!res) {
        const hostKnown = [...this.responses.keys()].some((k) => new URL(k).hostname === current.hostname);
        if (!hostKnown) throw new FetchFailure('network', `ENOTFOUND ${current.hostname}`);
        throw new FetchFailure('http', `HTTP 404 for ${current}`, 404);
      }
      const status = res.status ?? 200;
      if (status >= 300 && status < 400 && res.location) {
        const next = new URL(res.location, current);
        if (next.hostname.replace(/^www\./, '') !== origin.hostname.replace(/^www\./, '') && !options.allowCrossSiteRedirect) {
          throw new FetchFailure('redirect', 'off-site redirect');
        }
        redirects.push(next.toString());
        current = next;
        continue;
      }
      if (status >= 400) throw new FetchFailure([401, 403, 429].includes(status) ? 'blocked' : 'http', `HTTP ${status}`, status);
      const contentType = res.contentType ?? 'text/html; charset=utf-8';
      if ((options.accept ?? 'html') === 'html' && !/html|xml/.test(contentType)) throw new FetchFailure('not_html', contentType);
      return { requestedUrl: url, finalUrl: current.toString(), status, contentType, body: res.body ?? '', redirects };
    }
    throw new FetchFailure('redirect', 'too many redirects');
  }
}
