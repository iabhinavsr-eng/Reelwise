import { describe, expect, it } from 'vitest';

import { crawlWebsite, CrawlOptions } from '../src/crawler/crawl.js';
import { FixtureFetcher } from './fixtures/FixtureFetcher.js';
import { duplicates, ecommerce, forbidden, lawFirm, parked, pdfOnly, plumber, restaurant, robotsBlocked, wellness } from './fixtures/sites.js';

const opts = (fetcher: FixtureFetcher, overrides: Partial<CrawlOptions> = {}): CrawlOptions => ({
  fetcher,
  maxPages: 15,
  maxDepth: 2,
  concurrency: 4,
  totalBudgetMs: 10_000,
  ...overrides,
});

const paths = (urls: string[]) => urls.map((u) => new URL(u).pathname + new URL(u).search);

describe('crawlWebsite — local plumber', async () => {
  const fetcher = new FixtureFetcher(plumber);
  // Input typed without www / https: must redirect to the canonical origin.
  const result = await crawlWebsite('rapidflowplumbing.com', opts(fetcher));
  const crawled = paths(result.pages.map((p) => p.finalUrl));

  it('follows the www redirect and reports the canonical root', () => {
    expect(result.rootUrl).toBe('https://www.rapidflowplumbing.com/');
  });

  it('crawls the high-value pages', () => {
    for (const p of ['/', '/about-us', '/services', '/services/drain-cleaning', '/services/water-heater-repair', '/service-areas', '/contact']) {
      expect(crawled).toContain(p);
    }
  });

  it('never fetches legal, auth, cart, tag, author or pagination pages', () => {
    const requested = paths(fetcher.requested);
    for (const p of ['/privacy-policy', '/terms', '/cart', '/login', '/tag/tips', '/author/dave', '/blog/page/2']) {
      expect(requested).not.toContain(p);
    }
  });

  it('crawls each page once despite utm/duplicate links and records 404s as errors', () => {
    expect(crawled.filter((p) => p === '/services/drain-cleaning')).toHaveLength(1);
    expect(result.errors.map((e) => new URL(e.url).pathname)).toContain('/services/leak-detection');
  });

  it('classifies pages and strips repeated footer text from non-home pages', () => {
    const about = result.pages.find((p) => p.finalUrl.endsWith('/about-us'))!;
    expect(about.pageType).toBe('about');
    expect(about.content).toContain('Dave Kowalski');
    expect(about.content).not.toContain('Licensed & insured');
    expect(result.pages[0].pageType).toBe('home');
  });

  it('uses the sitemap and robots.txt', () => {
    expect(result.robotsFound).toBe(true);
    expect(result.sitemapUrls).toBeGreaterThan(0);
  });
});

describe('crawlWebsite — other business types', () => {
  it('law firm: practice areas, attorneys and FAQ, no author archive', async () => {
    const fetcher = new FixtureFetcher(lawFirm);
    const r = await crawlWebsite('https://hartmercerlaw.com', opts(fetcher));
    const crawled = paths(r.pages.map((p) => p.finalUrl));
    expect(crawled).toEqual(expect.arrayContaining(['/practice-areas', '/practice-areas/divorce', '/attorneys', '/faq', '/about']));
    expect(paths(fetcher.requested)).not.toContain('/author/laura');
  });

  it('wellness clinic: skips member login', async () => {
    const fetcher = new FixtureFetcher(wellness);
    const r = await crawlWebsite('lyteguards.com', opts(fetcher));
    const crawled = paths(r.pages.map((p) => p.finalUrl));
    expect(crawled).toEqual(expect.arrayContaining(['/mobile-iv', '/services', '/pricing', '/faq', '/about']));
    expect(paths(fetcher.requested)).not.toContain('/login');
  });

  it('ecommerce: caps product detail pages and skips cart/account/pagination', async () => {
    const fetcher = new FixtureFetcher(ecommerce);
    const r = await crawlWebsite('fernhillcandles.com', opts(fetcher));
    expect(r.pages.filter((p) => p.pageType === 'product_detail').length).toBeLessThanOrEqual(3);
    const crawled = paths(r.pages.map((p) => p.finalUrl));
    expect(crawled).toEqual(expect.arrayContaining(['/pages/about', '/collections/all', '/pages/faq']));
    const requested = paths(fetcher.requested);
    for (const p of ['/cart', '/account/login', '/collections/all?page=2']) expect(requested).not.toContain(p);
  });

  it('restaurant: menu, story and private events', async () => {
    const r = await crawlWebsite('https://www.nonnalucia.com', opts(new FixtureFetcher(restaurant)));
    const types = r.pages.map((p) => p.pageType);
    expect(types).toEqual(expect.arrayContaining(['home', 'menu', 'about']));
  });

  it('respects MAX_PAGES', async () => {
    const r = await crawlWebsite('https://www.rapidflowplumbing.com', opts(new FixtureFetcher(plumber), { maxPages: 3 }));
    expect(r.pages).toHaveLength(3);
    expect(r.pages[0].pageType).toBe('home');
  });
});

describe('crawlWebsite — duplicates', () => {
  it('collapses trailing slash, utm, index.html and canonical duplicates', async () => {
    const r = await crawlWebsite('https://dupe.example.com', opts(new FixtureFetcher(duplicates)));
    const crawled = paths(r.pages.map((p) => p.finalUrl));
    expect(crawled.filter((p) => p.startsWith('/about'))).toHaveLength(1);
    expect(crawled).not.toContain('/index.html');
    // /our-services declares /services as canonical (or has identical content)
    expect(crawled.filter((p) => p.includes('services'))).toHaveLength(1);
  });
});

describe('crawlWebsite — failures', () => {
  it('unreachable site → site_unreachable', async () => {
    await expect(crawlWebsite('https://does-not-exist-anywhere.com', opts(new FixtureFetcher()))).rejects.toMatchObject({ code: 'site_unreachable' });
  });
  it('403 → crawl_blocked', async () => {
    await expect(crawlWebsite('https://cloudwalled.com', opts(new FixtureFetcher(forbidden)))).rejects.toMatchObject({ code: 'crawl_blocked' });
  });
  it('robots.txt disallowing everything → crawl_blocked', async () => {
    await expect(crawlWebsite('https://private-biz.com', opts(new FixtureFetcher(robotsBlocked)))).rejects.toMatchObject({ code: 'crawl_blocked' });
  });
  it('non-HTML homepage → not_html', async () => {
    await expect(crawlWebsite('https://brochure-biz.com', opts(new FixtureFetcher(pdfOnly)))).rejects.toMatchObject({ code: 'not_html' });
  });
  it('invalid and unsafe URLs are rejected before any request', async () => {
    const fetcher = new FixtureFetcher();
    await expect(crawlWebsite('not a url', opts(fetcher))).rejects.toMatchObject({ code: 'invalid_url' });
    await expect(crawlWebsite('http://169.254.169.254/', opts(fetcher))).rejects.toMatchObject({ code: 'unsafe_url' });
    await expect(crawlWebsite('http://localhost:3000', opts(fetcher))).rejects.toMatchObject({ code: 'unsafe_url' });
    expect(fetcher.requested).toEqual([]);
  });
  it('a parked page crawls fine but yields almost no content', async () => {
    const r = await crawlWebsite('https://coming-soon-biz.com', opts(new FixtureFetcher(parked)));
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].content.length).toBeLessThan(50);
  });
});

describe('crawlWebsite — navigation signal', () => {
  it('treats unrecognised main-menu pages (e.g. /mobile-iv) as likely offerings', async () => {
    const r = await crawlWebsite('https://www.lyteguards.com', opts(new FixtureFetcher(wellness)));
    const mobileIv = r.pages.find((p) => p.finalUrl.endsWith('/mobile-iv'))!;
    expect(mobileIv.pageType).toBe('primary');
    expect(mobileIv.priority).toBeGreaterThan(30);
  });
});
