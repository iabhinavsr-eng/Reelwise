import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

import { AnalysisError } from './errors.js';
import { ExtractedPage, extractPage, removeBoilerplate } from './extract.js';
import { Fetcher, FetchFailure, homepageError } from './fetcher.js';
import { classifyUrl, PageType, TYPE_LIMITS } from './prioritize.js';
import { allowAll, parseRobots, Robots } from './robots.js';
import { canonicalKey, isSameSite, looksLikeHtmlPage, normalizeInputUrl, resolveLink } from './url.js';
import { assertPublicUrl } from './ssrf.js';

/** One crawled page, reduced to what the analysis needs. */
export interface WebsitePage {
  url: string;
  finalUrl: string;
  pageType: PageType;
  depth: number;
  priority: number;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: string[];
  content: string;
  structuredData: Record<string, unknown>[];
  siteName: string | null;
  fetchedAt: string;
}

export interface SkippedUrl {
  url: string;
  reason: string;
}

export interface CrawlResult {
  inputUrl: string;
  rootUrl: string;
  pages: WebsitePage[];
  skipped: SkippedUrl[];
  errors: SkippedUrl[];
  discoveredCount: number;
  robotsFound: boolean;
  sitemapUrls: number;
  durationMs: number;
}

export interface CrawlOptions {
  fetcher: Fetcher;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  totalBudgetMs: number;
  maxPageChars?: number;
  onProgress?: (p: { pagesCrawled: number; pagesPlanned: number }) => void;
  signal?: AbortSignal;
}

interface Candidate {
  url: URL;
  key: string;
  anchors: Set<string>;
  depth: number;
  inNav: boolean;
}

const MAX_SITEMAP_URLS = 300;

export async function crawlWebsite(inputUrl: string, opts: CrawlOptions): Promise<CrawlResult> {
  const started = Date.now();
  const deadline = started + opts.totalBudgetMs;
  const maxPageChars = opts.maxPageChars ?? 12_000;
  const start = normalizeInputUrl(inputUrl);
  assertPublicUrl(start);

  // 1. Homepage (cross-site redirect allowed once: example.com → example.co.uk).
  let homeRes;
  try {
    homeRes = await opts.fetcher.fetch(start.toString(), { allowCrossSiteRedirect: true });
  } catch (e) {
    // Many sites only answer on one scheme; try http once if https failed at the network level.
    if (start.protocol === 'https:' && e instanceof FetchFailure && (e.kind === 'network' || e.kind === 'timeout')) {
      const httpUrl = new URL(start);
      httpUrl.protocol = 'http:';
      try {
        homeRes = await opts.fetcher.fetch(httpUrl.toString(), { allowCrossSiteRedirect: true });
      } catch {
        throw homepageError(e);
      }
    } else {
      throw homepageError(e);
    }
  }
  const root = new URL(homeRes.finalUrl);
  assertPublicUrl(root);

  // 2. robots.txt (optional) — respected for everything after the homepage.
  let robots: Robots = allowAll;
  let robotsFound = false;
  try {
    const r = await opts.fetcher.fetch(new URL('/robots.txt', root).toString(), { accept: 'text' });
    robots = parseRobots(r.body);
    robotsFound = true;
  } catch {
    // No robots.txt → everything allowed.
  }
  if (!robots.isAllowed('/')) {
    throw new AnalysisError('crawl_blocked', 'This website asks automated tools not to read it.', 'robots.txt disallows /');
  }

  const pages: (WebsitePage & { blocks: string[]; isHome: boolean })[] = [];
  const skipped: SkippedUrl[] = [];
  const errors: SkippedUrl[] = [];
  const visited = new Set<string>();
  const contentHashes = new Set<string>();
  const candidates = new Map<string, Candidate>();
  const typeCounts = new Map<PageType, number>();

  const addPage = (
    url: string,
    finalUrl: string,
    status: number,
    depth: number,
    extracted: ExtractedPage,
    cls: { type: PageType; score: number },
  ): boolean => {
    const text = extracted.blocks.join('\n');
    const hash = createHash('sha1').update(text.slice(0, 5000)).digest('hex');
    if (contentHashes.has(hash) && text.length > 0) {
      skipped.push({ url, reason: 'duplicate content' });
      return false;
    }
    contentHashes.add(hash);
    typeCounts.set(cls.type, (typeCounts.get(cls.type) ?? 0) + 1);
    pages.push({
      url,
      finalUrl,
      pageType: cls.type,
      depth,
      priority: cls.score,
      statusCode: status,
      title: extracted.title,
      metaDescription: extracted.metaDescription,
      h1: extracted.h1,
      headings: extracted.headings,
      content: '',
      blocks: extracted.blocks,
      structuredData: extracted.structuredData,
      siteName: extracted.siteName,
      isHome: depth === 0,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  };

  const enqueueLinks = (links: { url: string; text: string; inNav?: boolean }[], depth: number) => {
    if (depth > opts.maxDepth) return;
    for (const link of links) {
      const url = new URL(link.url);
      if (!isSameSite(url, root) || !looksLikeHtmlPage(url)) continue;
      const key = canonicalKey(url);
      if (visited.has(key)) continue;
      const existing = candidates.get(key);
      if (existing) {
        if (link.text) existing.anchors.add(link.text);
        existing.depth = Math.min(existing.depth, depth);
        existing.inNav ||= !!link.inNav;
        continue;
      }
      candidates.set(key, { url, key, anchors: new Set(link.text ? [link.text] : []), depth, inNav: !!link.inNav });
    }
  };

  const homeExtract = extractPage(homeRes.body, homeRes.finalUrl);
  visited.add(canonicalKey(start));
  visited.add(canonicalKey(root));
  addPage(start.toString(), homeRes.finalUrl, homeRes.status, 0, homeExtract, { type: 'home', score: 100 });
  enqueueLinks(homeExtract.links, 1);

  // 3. Sitemap — finds service pages that aren't linked from the menu.
  let sitemapUrls = 0;
  const sitemapLocations = robots.sitemaps.length ? robots.sitemaps.slice(0, 2) : [new URL('/sitemap.xml', root).toString()];
  for (const loc of sitemapLocations) {
    if (Date.now() > deadline - 5000) break;
    const urls = await readSitemap(loc, root, opts.fetcher);
    sitemapUrls += urls.length;
    enqueueLinks(urls.map((u) => ({ url: u, text: '' })), 1);
  }
  const discoveredCount = () => candidates.size + visited.size;

  // 4. Waves: always fetch the best remaining candidates, favouring page types we don't have yet.
  const score = (c: Candidate) => {
    const anchor = [...c.anchors].join(' ');
    const cls = classifyUrl(c.url, anchor, c.depth);
    const coverageBonus = (typeCounts.get(cls.type) ?? 0) === 0 ? 15 : 0;
    // Main-menu pages the URL rules don't recognise (e.g. /mobile-iv) are usually core offerings.
    const navBonus = c.inNav && cls.type === 'other' ? 24 : c.inNav ? 4 : 0;
    const cls2 = c.inNav && cls.type === 'other' ? { ...cls, type: 'primary' as PageType, score: cls.score + navBonus } : cls;
    return { cls: cls2, value: cls2.score + coverageBonus + (cls2 === cls ? navBonus : 0) };
  };

  while (pages.length < opts.maxPages && Date.now() < deadline && !opts.signal?.aborted) {
    const ranked = [...candidates.values()]
      .map((c) => ({ c, ...score(c) }))
      .filter(({ c, cls }) => {
        if (cls.excluded) {
          skipped.push({ url: c.url.toString(), reason: cls.reason ?? 'excluded' });
          candidates.delete(c.key);
          return false;
        }
        const limit = TYPE_LIMITS[cls.type];
        return limit === undefined || (typeCounts.get(cls.type) ?? 0) < limit;
      })
      .sort((a, b) => b.value - a.value);
    if (!ranked.length) break;

    // Build the batch respecting per-type caps *including* pages already in this batch.
    const batchSize = Math.min(opts.concurrency, opts.maxPages - pages.length);
    const planned = new Map<PageType, number>();
    const batch: typeof ranked = [];
    for (const item of ranked) {
      if (batch.length >= batchSize) break;
      const limit = TYPE_LIMITS[item.cls.type];
      const count = (typeCounts.get(item.cls.type) ?? 0) + (planned.get(item.cls.type) ?? 0);
      if (limit !== undefined && count >= limit) continue;
      planned.set(item.cls.type, (planned.get(item.cls.type) ?? 0) + 1);
      batch.push(item);
    }
    if (!batch.length) break;
    for (const { c } of batch) {
      candidates.delete(c.key);
      visited.add(c.key);
    }
    opts.onProgress?.({ pagesCrawled: pages.length, pagesPlanned: Math.min(opts.maxPages, pages.length + ranked.length) });

    await Promise.all(
      batch.map(async ({ c, cls }) => {
        const pathWithQuery = c.url.pathname + c.url.search;
        if (!robots.isAllowed(pathWithQuery)) {
          skipped.push({ url: c.url.toString(), reason: 'robots.txt' });
          return;
        }
        try {
          const res = await opts.fetcher.fetch(c.url.toString());
          const finalKey = canonicalKey(res.finalUrl);
          if (finalKey !== c.key && visited.has(finalKey)) {
            skipped.push({ url: c.url.toString(), reason: 'redirects to a visited page' });
            return;
          }
          visited.add(finalKey);
          const extracted = extractPage(res.body, res.finalUrl);
          if (extracted.canonical && isSameSite(extracted.canonical, root)) {
            const canonKey = canonicalKey(extracted.canonical);
            if (canonKey !== finalKey && visited.has(canonKey)) {
              skipped.push({ url: c.url.toString(), reason: 'canonical duplicate' });
              return;
            }
            visited.add(canonKey);
          }
          if (pages.length >= opts.maxPages) return;
          if (addPage(c.url.toString(), res.finalUrl, res.status, c.depth, extracted, cls)) enqueueLinks(extracted.links, c.depth + 1);
        } catch (e) {
          errors.push({ url: c.url.toString(), reason: e instanceof Error ? e.message : String(e) });
        }
      }),
    );
  }

  opts.onProgress?.({ pagesCrawled: pages.length, pagesPlanned: pages.length });

  const cleaned = removeBoilerplate(pages).map(({ blocks, isHome: _isHome, ...page }) => ({
    ...page,
    content: truncate(blocks.join('\n'), maxPageChars),
  }));

  return {
    inputUrl,
    rootUrl: root.toString(),
    pages: cleaned,
    skipped,
    errors,
    discoveredCount: discoveredCount(),
    robotsFound,
    sitemapUrls,
    durationMs: Date.now() - started,
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastBreak = cut.lastIndexOf('\n');
  return `${lastBreak > max * 0.7 ? cut.slice(0, lastBreak) : cut}\n…`;
}

/** Reads a sitemap (following one level of sitemap index). Errors → empty. */
async function readSitemap(location: string, root: URL, fetcher: Fetcher): Promise<string[]> {
  const out: string[] = [];
  const read = async (loc: string, depth: number) => {
    const url = resolveLink(loc, root.toString());
    if (!url || !isSameSite(url, root)) return;
    let body: string;
    try {
      body = (await fetcher.fetch(url.toString(), { accept: 'xml' })).body;
    } catch {
      return;
    }
    const $ = cheerio.load(body, { xml: true });
    const nested = $('sitemapindex > sitemap > loc').map((_, el) => $(el).text().trim()).get();
    if (nested.length && depth === 0) {
      // Prefer page/post sitemaps over product/image sitemaps.
      const ordered = nested.sort((a, b) => Number(/product|image|video|tag|author|category/.test(a)) - Number(/product|image|video|tag|author|category/.test(b)));
      for (const n of ordered.slice(0, 3)) {
        if (out.length >= MAX_SITEMAP_URLS) break;
        await read(n, depth + 1);
      }
      return;
    }
    $('urlset > url > loc').each((_, el) => {
      if (out.length < MAX_SITEMAP_URLS) out.push($(el).text().trim());
    });
  };
  await read(location, 0);
  return out;
}
