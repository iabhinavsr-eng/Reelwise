import type { CrawlResult, WebsitePage } from '../crawler/crawl.js';
import type { ManualInput } from './types.js';

/** A page as the AI sees it: an id it can cite, plus trimmed content. */
export interface EvidencePage {
  id: string; // P1, P2, … (P0 = owner-provided answers)
  url: string;
  pageType: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: string[];
  content: string;
  structuredData: Record<string, unknown>[];
}

export interface WebsiteEvidence {
  websiteUrl: string;
  siteNameHints: string[];
  pages: EvidencePage[];
  totalChars: number;
}

export const OWNER_SOURCE = 'owner-provided';

const TOTAL_BUDGET = 60_000;
const HOME_BUDGET = 9_000;
const PAGE_BUDGET = 6_000;

/**
 * Packs crawled pages into a bounded, prioritized evidence bundle. Raw HTML
 * never reaches the model — only extracted text and structured data.
 */
export function buildEvidence(crawl: CrawlResult | null, manual?: ManualInput, websiteUrl?: string): WebsiteEvidence {
  const pages: EvidencePage[] = [];
  let total = 0;

  if (manual) {
    const content = [
      `Business name: ${manual.businessName}`,
      `What the business does: ${manual.whatYouDo}`,
      manual.customers ? `Who the customers are: ${manual.customers}` : '',
      manual.differentiators ? `What makes the business different: ${manual.differentiators}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    pages.push({
      id: 'P0',
      url: OWNER_SOURCE,
      pageType: 'owner_answers',
      title: 'Answers provided by the business owner',
      metaDescription: null,
      h1: null,
      headings: [],
      content,
      structuredData: [],
    });
    total += content.length;
  }

  const sorted: WebsitePage[] = crawl ? [...crawl.pages].sort((a, b) => (a.depth === 0 ? -1 : b.depth === 0 ? 1 : b.priority - a.priority)) : [];
  sorted.forEach((page, i) => {
    const budget = Math.min(page.depth === 0 ? HOME_BUDGET : PAGE_BUDGET, TOTAL_BUDGET - total);
    if (budget < 400 && i > 0) return;
    const content = page.content.length > budget ? `${page.content.slice(0, budget)}\n…` : page.content;
    total += content.length;
    pages.push({
      id: `P${pages.filter((p) => p.id !== 'P0').length + 1}`,
      url: page.finalUrl,
      pageType: page.pageType,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      headings: page.headings.slice(0, 15),
      content,
      structuredData: page.structuredData.slice(0, 4),
    });
  });

  const hints = new Set<string>();
  for (const p of crawl?.pages ?? []) {
    if (p.siteName) hints.add(p.siteName);
    for (const d of p.structuredData) {
      const type = String(d['@type'] ?? '');
      if (typeof d.name === 'string' && !/Product|Offer|Service|FAQ|Question/.test(type)) hints.add(d.name);
    }
  }
  if (manual?.businessName) hints.add(manual.businessName);

  return { websiteUrl: crawl?.rootUrl ?? websiteUrl ?? '', siteNameHints: [...hints].slice(0, 5), pages, totalChars: total };
}

/** Readable text length across the evidence — used to detect "not enough to go on". */
export function usableChars(evidence: WebsiteEvidence): number {
  return evidence.pages.reduce((n, p) => n + p.content.length + (p.metaDescription?.length ?? 0) + (p.h1?.length ?? 0), 0);
}

/** Serializes evidence for the prompt. Content is wrapped as untrusted data. */
export function renderEvidence(evidence: WebsiteEvidence): string {
  const parts = [`Website: ${evidence.websiteUrl}`];
  if (evidence.siteNameHints.length) parts.push(`Name hints from site metadata: ${evidence.siteNameHints.join(' | ')}`);
  for (const p of evidence.pages) {
    const lines = [
      `<page id="${p.id}" url="${p.url}" type="${p.pageType}">`,
      p.title ? `TITLE: ${p.title}` : '',
      p.metaDescription ? `META DESCRIPTION: ${p.metaDescription}` : '',
      p.h1 ? `H1: ${p.h1}` : '',
      p.headings.length ? `H2: ${p.headings.join(' | ')}` : '',
      p.structuredData.length ? `STRUCTURED DATA: ${JSON.stringify(p.structuredData).slice(0, 2500)}` : '',
      'TEXT:',
      p.content,
      '</page>',
    ];
    parts.push(lines.filter(Boolean).join('\n'));
  }
  return parts.join('\n\n');
}
