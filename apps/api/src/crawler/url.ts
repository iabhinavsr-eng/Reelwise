import { AnalysisError } from './errors.js';

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|gbraid|wbraid|msclkid|mc_[a-z]+|_ga|_gl|ref|hsa_[a-z]+|yclid|igshid)$/i;

/**
 * Turns what a person types ("mybiz.com", "www.mybiz.com/about/",
 * "HTTP://MyBiz.com") into an absolute http(s) URL. Throws `invalid_url`.
 */
export function normalizeInputUrl(input: string): URL {
  let value = (input ?? '').trim();
  if (!value || value.length > 2048 || /\s/.test(value)) {
    throw new AnalysisError('invalid_url', 'That doesn’t look like a website address.');
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AnalysisError('invalid_url', 'That doesn’t look like a website address.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AnalysisError('invalid_url', 'Only http and https websites can be analyzed.');
  }
  if (url.username || url.password) {
    throw new AnalysisError('invalid_url', 'Website addresses with credentials aren’t supported.');
  }
  url.hash = '';
  return url;
}

/** Host without a leading "www." — www and non-www are the same site. */
export function siteHost(url: URL | string): string {
  const host = typeof url === 'string' ? new URL(url).hostname : url.hostname;
  return host.toLowerCase().replace(/^www\./, '');
}

export function isSameSite(a: URL | string, b: URL | string): boolean {
  return siteHost(a) === siteHost(b);
}

/**
 * Deduplication key: scheme-agnostic, www-agnostic, no fragment, no
 * tracking params, sorted query, no trailing slash, no index.html.
 */
export function canonicalKey(url: URL | string): string {
  const u = new URL(typeof url === 'string' ? url : url.toString());
  let path = u.pathname.replace(/\/+/g, '/');
  path = path.replace(/\/(index|default)\.(html?|php|aspx?)$/i, '/');
  if (path.length > 1) path = path.replace(/\/$/, '');
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  return `${siteHost(u)}${path}${query}`;
}

/** Resolves an href against a page URL; returns null for non-http(s) or junk. */
export function resolveLink(href: string | undefined, base: string): URL | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#') || /^(mailto|tel|sms|javascript|data|ftp|file):/i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    return url;
  } catch {
    return null;
  }
}

const NON_HTML_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|ico|bmp|tiff?|mp4|mov|avi|webm|mp3|wav|zip|rar|gz|7z|docx?|xlsx?|pptx?|csv|json|xml|txt|css|js|woff2?|ttf|eot|dmg|exe|apk)$/i;

export function looksLikeHtmlPage(url: URL): boolean {
  return !NON_HTML_EXT.test(url.pathname);
}
