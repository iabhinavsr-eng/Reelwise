/**
 * Developer CLI: run the real pipeline against a URL and print what happened.
 *
 *   npm run analyze -- https://example.com            # crawl + AI (needs OPENAI_API_KEY)
 *   npm run analyze -- https://example.com --crawl    # crawl + evidence only
 */
import { buildEvidence } from '../src/analysis/evidence.js';
import { runAnalysisPipeline } from '../src/analysis/pipeline.js';
import { OpenAIProvider } from '../src/analysis/providers/OpenAIProvider.js';
import type { AnalysisDebug } from '../src/analysis/types.js';
import { config } from '../src/config.js';
import { crawlWebsite } from '../src/crawler/crawl.js';
import { SafeFetcher } from '../src/crawler/fetcher.js';

const [url, flag] = process.argv.slice(2);
if (!url) {
  console.error('Usage: npm run analyze -- <url> [--crawl]');
  process.exit(1);
}

const fetcher = new SafeFetcher({ timeoutMs: config.crawl.requestTimeoutMs, maxBytes: config.crawl.maxResponseBytes, retries: 1 });

if (flag === '--crawl') {
  const crawl = await crawlWebsite(url, { fetcher, ...config.crawl, onProgress: (p) => process.stderr.write(`\rcrawled ${p.pagesCrawled}/${p.pagesPlanned}`) });
  console.error(`\n${crawl.pages.length} pages in ${crawl.durationMs}ms (discovered ${crawl.discoveredCount}, skipped ${crawl.skipped.length}, errors ${crawl.errors.length})`);
  for (const p of crawl.pages) console.log(`[${p.pageType.padEnd(14)}] ${String(p.priority).padStart(4)}  ${p.finalUrl}  (${p.content.length} chars)`);
  const evidence = buildEvidence(crawl);
  console.log(`\nEvidence: ${evidence.pages.length} pages, ${evidence.totalChars} chars. Name hints: ${evidence.siteNameHints.join(' | ')}`);
  process.exit(0);
}

const ai = config.ai.openaiApiKey
  ? new OpenAIProvider({ apiKey: config.ai.openaiApiKey, model: config.ai.openaiModel, baseUrl: config.ai.openaiBaseUrl, temperature: config.ai.temperature })
  : null;
const debug: AnalysisDebug = { evidencePages: [], rejectedClaims: [], warnings: [], timings: {} };
try {
  const result = await runAnalysisPipeline({ analysisId: 'cli', version: 1, url }, { fetcher, ai, crawl: config.crawl }, debug, {
    onStatus: (s, d) => console.error(`… ${s}${d.phase ? `:${d.phase}` : ''}${d.pagesCrawled !== undefined ? ` (${d.pagesCrawled} pages)` : ''}`),
  });
  console.log(JSON.stringify({ result, debug: { ...debug, rawProfile: undefined, rawPositioning: undefined } }, null, 2));
} catch (e) {
  console.error('FAILED:', e);
  console.error(JSON.stringify(debug, null, 2));
  process.exit(1);
}
