import { describe, expect, it } from 'vitest';

import { extractPage, removeBoilerplate } from '../src/crawler/extract.js';
import { classifyUrl } from '../src/crawler/prioritize.js';
import { parseRobots } from '../src/crawler/robots.js';
import { plumber } from './fixtures/sites.js';

const home = plumber.responses['https://www.rapidflowplumbing.com/'].body!;

describe('extractPage', () => {
  const page = extractPage(home, 'https://www.rapidflowplumbing.com/');

  it('extracts title, meta description, H1 and H2s', () => {
    expect(page.title).toBe('Rapid Flow Plumbing | 24/7 Emergency Plumber in Columbus, OH');
    expect(page.metaDescription).toMatch(/Licensed Columbus plumbers/);
    expect(page.h1).toBe('Columbus plumbers who show up when you need them');
    expect(page.headings).toEqual(['24/7 emergency plumbing', 'Upfront flat-rate pricing']);
    expect(page.siteName).toBe('Rapid Flow Plumbing');
  });

  it('keeps readable main text and strips scripts, styles, nav, footer and cookie banners', () => {
    const text = page.blocks.join('\n');
    expect(text).toContain('Our licensed plumbers answer the phone around the clock');
    expect(text).not.toMatch(/track everything|color:red/);
    expect(text).not.toMatch(/We use cookies/);
    expect(text).not.toMatch(/Privacy Policy/);
    expect(text).not.toMatch(/1420 Parsons Ave/); // footer
  });

  it('collects links (including nav and footer) with anchor text, resolved and de-duplicated', () => {
    const urls = page.links.map((l) => l.url);
    expect(urls).toContain('https://www.rapidflowplumbing.com/about-us');
    expect(urls).toContain('https://www.rapidflowplumbing.com/privacy-policy');
    expect(page.links.find((l) => l.url.endsWith('/service-areas'))?.text).toBe('Areas We Serve');
    // utm variant collapses into the same link once tracking params are dropped
    expect(urls.filter((u) => u.endsWith('/services/drain-cleaning'))).toHaveLength(1);
  });

  it('parses JSON-LD and keeps only fact-bearing fields', () => {
    expect(page.structuredData).toHaveLength(1);
    expect(page.structuredData[0]).toMatchObject({ '@type': 'Plumber', name: 'Rapid Flow Plumbing', areaServed: ['Columbus', 'Bexley', 'Grandview Heights', 'Upper Arlington'] });
    expect(page.structuredData[0]).not.toHaveProperty('@context');
  });

  it('tolerates malformed JSON-LD and missing tags', () => {
    const p = extractPage('<html><head><script type="application/ld+json">{broken</script></head><body><p>Hi there</p></body></html>', 'https://x.com/');
    expect(p.structuredData).toEqual([]);
    expect(p.title).toBeNull();
    expect(p.blocks).toEqual(['Hi there']);
  });
});

describe('removeBoilerplate', () => {
  it('removes blocks repeated across most pages, but keeps them on the homepage', () => {
    const pages = [
      { isHome: true, blocks: ['Welcome', 'Call us 555-0100', 'Serving Denver since 2001'] },
      { isHome: false, blocks: ['About us', 'Call us 555-0100', 'Serving Denver since 2001'] },
      { isHome: false, blocks: ['Services', 'Call us 555-0100', 'Serving Denver since 2001'] },
      { isHome: false, blocks: ['FAQ', 'Call us 555-0100'] },
    ];
    const out = removeBoilerplate(pages);
    expect(out[0].blocks).toContain('Serving Denver since 2001');
    expect(out[1].blocks).toEqual(['About us']);
    expect(out[3].blocks).toEqual(['FAQ']);
  });
});

describe('classifyUrl (page prioritization)', () => {
  const score = (path: string, anchor = '', depth = 1) => classifyUrl(new URL(`https://biz.com${path}`), anchor, depth);

  it('ranks business-explaining pages above generic ones', () => {
    expect(score('/about-us').score).toBeGreaterThan(score('/gallery').score);
    expect(score('/services').score).toBeGreaterThan(score('/blog').score);
    expect(score('/services/drain-cleaning').type).toBe('service_detail');
    expect(score('/practice-areas/divorce').type).toBe('service_detail');
    expect(score('/menu').type).toBe('menu');
    expect(score('/pages/about').type).toBe('about');
    expect(score('/collections/all').type).toBe('products');
    expect(score('/products/cedar-candle').type).toBe('product_detail');
    expect(score('/our-work', 'Services').type).toBe('services'); // anchor text counts
  });

  it.each(['/privacy-policy', '/terms', '/cookie-policy', '/login', '/account/login', '/cart', '/checkout', '/tag/tips', '/author/dave', '/blog/page/2', '/category/news', '/wp-admin', '/feed', '/search?q=x', '/collections/all?page=2'])(
    'excludes %s',
    (path) => expect(score(path).excluded).toBe(true),
  );

  it('penalizes depth and blog posts', () => {
    expect(score('/about', '', 2).score).toBeLessThan(score('/about', '', 1).score);
    expect(score('/blog/2024/05/tips').score).toBeLessThan(score('/blog').score);
  });
});

describe('parseRobots', () => {
  it('applies longest-match Allow/Disallow for * and our bot', () => {
    const robots = parseRobots(`User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\n\nUser-agent: GPTBot\nDisallow: /\nSitemap: https://biz.com/sitemap.xml`);
    expect(robots.isAllowed('/')).toBe(true);
    expect(robots.isAllowed('/private/x')).toBe(false);
    expect(robots.isAllowed('/private/ok/page')).toBe(true);
    expect(robots.isAllowed('/menu.pdf')).toBe(false);
    expect(robots.sitemaps).toEqual(['https://biz.com/sitemap.xml']);
  });

  it('prefers a group addressed to ReelwiseBot', () => {
    const robots = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: ReelwiseBot\nDisallow: /admin');
    expect(robots.isAllowed('/about')).toBe(true);
    expect(robots.isAllowed('/admin')).toBe(false);
  });

  it('treats an empty Disallow as allow-all', () => {
    expect(parseRobots('User-agent: *\nDisallow:').isAllowed('/anything')).toBe(true);
  });
});
