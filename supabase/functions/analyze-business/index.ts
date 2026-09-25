// Supabase Edge Function: analyze-business
//
// The mobile app sends { url }. This function is where website crawling and
// AI analysis will run, using secrets that never reach the client:
//
//   supabase secrets set ANTHROPIC_API_KEY=... CRAWLER_API_KEY=...
//
// Today it returns a deterministic draft so the end-to-end path (auth →
// function → app) can be exercised. Replace `draftAnalysis` with:
//   1. fetch + extract the site's key pages (home, about, services)
//   2. prompt the model for business profile, audience (ICP), value
//      proposition (UVP), suggested goals and voice
//   3. validate the model output against the BusinessAnalysis shape
//
// Response shape must match `BusinessAnalysis` in
// apps/mobile/src/services/analysis/BusinessAnalysisService.ts.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Only public http(s) hosts — crawling must never reach internal addresses (SSRF). */
function parsePublicUrl(input: unknown): URL | null {
  if (typeof input !== 'string' || input.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null; // raw IPs
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
  return url;
}

function titleFromHost(host: string) {
  const base = host.replace(/^www\./, '').split('.')[0] ?? host;
  return base
    .split(/[-_\d]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function draftAnalysis(url: URL) {
  const name = titleFromHost(url.hostname) || 'Your Business';
  return {
    business: {
      name,
      websiteUrl: url.toString().replace(/\/$/, ''),
      industry: 'Local Services',
      primaryLocation: '',
      description: `${name} is a locally owned business that helps customers with personal, reliable service.`,
      services: [],
    },
    audience: {
      summary: 'Local customers who want to buy from a business they know and trust.',
      structuredAttributes: {},
    },
    valueProposition: {
      summary: `${name} gives every customer personal attention and honest advice.`,
    },
    suggestedGoals: ['educate', 'build_trust'],
    suggestedVoiceTraits: ['conversational', 'straightforward'],
    provider: 'edge-draft',
    analyzedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  // JWT verification is enforced by the Supabase gateway (verify_jwt = true).

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const url = parsePublicUrl(body.url);
  if (!url) return json({ error: 'Please provide a public website URL.' }, 400);

  return json(draftAnalysis(url));
});
