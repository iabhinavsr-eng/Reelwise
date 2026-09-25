import * as cheerio from 'cheerio';

import { resolveLink } from './url.js';

export interface ExtractedLink {
  url: string;
  text: string;
  /** Linked from the site's main navigation/header — a strong "important page" signal. */
  inNav: boolean;
}

export interface ExtractedPage {
  title: string | null;
  metaDescription: string | null;
  siteName: string | null;
  canonical: string | null;
  h1: string | null;
  headings: string[];
  /** Readable text as de-duplicated blocks (one per paragraph / list item / heading). */
  blocks: string[];
  links: ExtractedLink[];
  structuredData: Record<string, unknown>[];
  noindex: boolean;
}

const clean = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim();

const REMOVE = [
  'script:not([type="application/ld+json"])',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'canvas',
  'video',
  'audio',
  'picture source',
  'form',
  'button',
  'select',
  'input',
  'nav',
  'footer',
  'aside',
  '[role="navigation"]',
  '[role="contentinfo"]',
  '[role="dialog"]',
  '[aria-hidden="true"]',
  '[hidden]',
].join(',');

/** Class/id fragments of cookie banners, popups and similar chrome. */
const CHROME_PATTERN = /(^|[\s_-])(cookie|consent|gdpr|ccpa|newsletter-popup|popup|modal|lightbox|skip-link|screen-reader|sr-only|visually-hidden|breadcrumbs?|social-share|share-buttons|announcement-bar)([\s_-]|$)/i;

const BLOCK_TAGS = 'p,li,h1,h2,h3,h4,h5,h6,dt,dd,td,th,blockquote,figcaption,address,div,section,article,header,main,br,tr';

/** Structured-data keys worth keeping — facts, not SEO noise. */
const LD_KEYS = new Set([
  '@type', 'name', 'legalName', 'alternateName', 'description', 'slogan', 'url', 'telephone', 'email', 'address',
  'streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry', 'areaServed', 'serviceArea',
  'geo', 'priceRange', 'openingHours', 'openingHoursSpecification', 'servesCuisine', 'hasMenu', 'makesOffer',
  'hasOfferCatalog', 'itemListElement', 'itemOffered', 'serviceType', 'provider', 'brand', 'category', 'offers',
  'price', 'priceCurrency', 'aggregateRating', 'ratingValue', 'reviewCount', 'foundingDate', 'founder',
  'numberOfEmployees', 'knowsAbout', 'medicalSpecialty', 'mainEntity', 'acceptedAnswer', 'text', 'dayOfWeek', 'opens', 'closes',
]);

function pruneLd(value: unknown, depth = 0): unknown {
  if (depth > 5) return undefined;
  if (Array.isArray(value)) return value.slice(0, 25).map((v) => pruneLd(v, depth + 1)).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!LD_KEYS.has(k)) continue;
      const pruned = pruneLd(v, depth + 1);
      if (pruned !== undefined && !(typeof pruned === 'object' && pruned !== null && Object.keys(pruned).length === 0)) out[k] = pruned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  return value;
}

function parseJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const graph = (item as { '@graph'?: unknown[] })?.['@graph'];
        for (const node of Array.isArray(graph) ? graph : [item]) {
          const type = (node as { '@type'?: unknown })?.['@type'];
          const types = (Array.isArray(type) ? type : [type]).map(String);
          // Skip pure SEO scaffolding.
          if (types.every((t) => /^(WebSite|WebPage|BreadcrumbList|ImageObject|SiteNavigationElement|ReadAction|SearchAction|undefined)$/.test(t))) continue;
          const pruned = pruneLd(node);
          if (pruned) out.push(pruned as Record<string, unknown>);
        }
      }
    } catch {
      // Malformed JSON-LD is common; ignore it.
    }
  });
  return out.slice(0, 10);
}

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const title = clean($('title').first().text()) || null;
  const metaDescription =
    clean($('meta[name="description"]').attr('content')) || clean($('meta[property="og:description"]').attr('content')) || null;
  const siteName = clean($('meta[property="og:site_name"]').attr('content')) || null;
  const canonicalHref = $('link[rel="canonical"]').attr('href');
  const canonical = canonicalHref ? resolveLink(canonicalHref, pageUrl)?.toString() ?? null : null;
  const robotsMeta = ($('meta[name="robots"]').attr('content') ?? '').toLowerCase();
  const structuredData = parseJsonLd($);

  // Links are collected BEFORE removing nav/footer — menus are how we discover pages.
  const seen = new Set<string>();
  const links: ExtractedLink[] = [];
  $('a[href]').each((_, el) => {
    const url = resolveLink($(el).attr('href'), pageUrl);
    if (!url) return;
    const key = url.toString();
    const text = clean($(el).text()) || clean($(el).attr('title')) || clean($(el).attr('aria-label'));
    const inNav = $(el).closest('nav, header, [role="navigation"]').length > 0;
    if (seen.has(key)) {
      const existing = links.find((l) => l.url === key);
      if (existing && !existing.text && text) existing.text = text;
      if (existing && inNav) existing.inNav = true;
      return;
    }
    seen.add(key);
    links.push({ url: key, text: text.slice(0, 120), inNav });
  });

  $(REMOVE).remove();
  $('[class],[id]').each((_, el) => {
    const $el = $(el);
    const marker = `${$el.attr('class') ?? ''} ${$el.attr('id') ?? ''}`;
    // Never drop the page's main wrapper just because of a class name.
    if (CHROME_PATTERN.test(marker) && $el.text().length < 2000) $el.remove();
  });

  const h1 = clean($('h1').first().text()) || null;
  const headings = $('h2')
    .map((_, el) => clean($(el).text()))
    .get()
    .filter((h) => h && h.length <= 160)
    .filter((h, i, all) => all.indexOf(h) === i)
    .slice(0, 25);

  // Prefer the main content region when it has real text.
  const mainCandidates = ['main', '[role="main"]', 'article', '#content', '.content', '#main'];
  let root: cheerio.Cheerio<import('domhandler').AnyNode> = $('body');
  for (const sel of mainCandidates) {
    const el = $(sel).first();
    if (el.length && clean(el.text()).length > 200) {
      root = el;
      break;
    }
  }
  if (!root.length) root = $.root();

  // Mark block boundaries so text doesn't run together, then split into blocks.
  root.find(BLOCK_TAGS).each((_, el) => {
    if (el.type === 'tag' && el.name === 'br') $(el).replaceWith('\n');
    else $(el).append('\n');
  });
  const blocks: string[] = [];
  const blockSeen = new Set<string>();
  for (const line of root.text().split('\n')) {
    const text = clean(line);
    if (text.length < 2 || blockSeen.has(text)) continue;
    blockSeen.add(text);
    blocks.push(text);
  }

  return {
    title,
    metaDescription,
    siteName,
    canonical,
    h1,
    headings,
    blocks,
    links,
    structuredData,
    noindex: /\bnoindex\b/.test(robotsMeta),
  };
}

/**
 * Removes text repeated across pages (header taglines, footer addresses,
 * newsletter blurbs). Repeated blocks are kept once — on the homepage — so
 * facts that only appear in a footer (like an address) aren't lost.
 */
export function removeBoilerplate<T extends { blocks: string[]; isHome: boolean }>(pages: T[]): T[] {
  if (pages.length < 3) return pages;
  const counts = new Map<string, number>();
  for (const page of pages) for (const block of new Set(page.blocks)) counts.set(block, (counts.get(block) ?? 0) + 1);
  const threshold = Math.max(3, Math.ceil(pages.length * 0.5));
  const repeated = new Set([...counts].filter(([block, n]) => n >= threshold && block.length < 400).map(([b]) => b));
  return pages.map((page) => (page.isHome ? page : { ...page, blocks: page.blocks.filter((b) => !repeated.has(b)) }));
}
