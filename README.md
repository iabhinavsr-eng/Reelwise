# Reelwise

An AI-first short-form video marketing app for small and medium-sized businesses.

> Tell us about your business once, and we'll keep telling you what to talk about on camera.

- **Phase 1:** account creation → business URL → analysis → review and edit the business profile, ideal customer, and value proposition → content goals and voice → Content Playbook → recommended reel ideas.
- **Phase 2 (current):** the analysis is real. A backend crawls the actual website, extracts facts it can verify, and uses an LLM to draft the profile, the ideal customer (ICP), and the value proposition (UVP). Every factual claim is traced to a source page.

Not built yet: recording, teleprompter, editing, publishing, and the script engine.

---

## Repository layout

```
apps/mobile/          Expo + React Native + TypeScript app (iOS-first, Android-ready)
apps/api/             Reelwise API (Node + Hono): crawler, AI analysis pipeline, jobs
supabase/
  migrations/         Postgres schema + row-level security (Phase 1 + Phase 2)
  config.toml         Supabase CLI local config
docs/                 Screenshots of each phase
artifacts/reelwise/   Reelwise design tokens (source of truth for colors/radius)
artifacts/, lib/, …   Pre-existing Replit pnpm-workspace scaffold (unused)
```

`apps/mobile` and `apps/api` sit outside the root pnpm workspace. That workspace is tuned for Replit's Linux containers and strips the macOS native binaries that Metro and esbuild need. Each app has its own `package.json` and `package-lock.json` and installs with npm.

---

## Quick start

### 1. App only (demo mode, no backend)

```bash
cd apps/mobile && npm install && npx expo start     # scan the QR code with Expo Go
```

Accounts live on the device, and analysis uses realistic on-device mock data:
- URLs with `wellness`, `dental`, `hvac`, or `fit` in them get industry-specific results.
- A URL containing `offline` simulates a network error.
- A URL containing `thin` simulates "couldn't learn enough", which leads into the manual fallback.

### 2. App + real analysis (no Supabase needed)

```bash
# Terminal 1: API
cd apps/api && npm install
cp .env.example .env        # set AUTH_MODE=dev and OPENAI_API_KEY=sk-...
npm run dev                 # → http://0.0.0.0:8787  (GET /health to check)

# Terminal 2: app
cd apps/mobile
echo "EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8787" > .env.local
npx expo start --clear
```

Create an account, enter a real website, and tap **Analyze my business**. The server fetches the actual site. In dev builds, the business screen has a **Developer: inspect this analysis →** link that opens the debug view.

`AUTH_MODE=dev` trusts the demo-mode user id header. It's meant for your laptop only, and the server refuses to start in dev mode when `NODE_ENV=production`.

### 3. Production-shaped (Supabase auth + database)

1. Create a Supabase project. Apply `supabase/migrations/*.sql` in order, either with `supabase db push` or by pasting them into the SQL editor.
2. For development, turn off **Auth → Email → Confirm email**. If it's on, the app shows a "check your inbox" state and then sign-in.
3. Configure the API (`apps/api/.env`):
   - `AUTH_MODE=supabase`
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - `DATABASE_URL`: Supabase → Database → connection string (pooler)
   - `OPENAI_API_KEY` and `OPENAI_MODEL`
4. Configure the app (`apps/mobile/.env.local`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_URL`.
5. Deploy the API anywhere that runs a container (`apps/api/Dockerfile`), for example Fly.io, Render, or Railway. The Dockerfile hasn't been built or run yet.

### Tuning the analysis from the terminal

```bash
cd apps/api
npm run analyze -- https://some-business.com --crawl   # which pages get picked, and what text is extracted
npm run analyze -- https://some-business.com           # full pipeline (needs OPENAI_API_KEY): result + debug JSON
```

---

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app | Supabase client. Leave empty for demo mode. The anon key is public by design. |
| `EXPO_PUBLIC_API_URL` | app | Reelwise API base URL. Leave empty for the on-device mock analysis. |
| `EXPO_PUBLIC_ENABLE_DEBUG_TOOLS` | app | Shows the analysis debug view outside dev builds. Internal builds only. |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TEMPERATURE`, `OPENAI_BASE_URL` | **API only** | LLM access. **Never put these in the app.** |
| `DATABASE_URL` | **API only** | Direct Postgres connection used to write analyses. Secret. |
| `AUTH_MODE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` | API | How the API verifies users. |
| `CRAWL_*`, `ANALYSIS_*`, `DEBUG_ENDPOINTS`, `CORS_ORIGINS` | API | Limits and toggles. See `apps/api/.env.example`. |

Anything prefixed `EXPO_PUBLIC_` is compiled into the app bundle and is public. `.env` and `.env*.local` are git-ignored.

---

## Architecture

```
iOS app ──POST /business/analyze {url}──▶ API ──enqueue──▶ AnalysisJobRunner
   │                                        │                  │
   │◀── 202 {jobId} ────────────────────────┘                  ▼
   │                                              ┌─ crawler: normalize → robots/sitemap → prioritized crawl (≤15 pages)
   ├──GET /business/analysis/:jobId (poll) ──┐    │           → extract title/meta/H1/H2/text/JSON-LD → strip boilerplate
   │   {status: queued|crawling|analyzing,   │    ├─ evidence: pages P1..Pn (bounded, prioritized, untrusted-data framing)
   │    phase: profile|positioning}          │    ├─ AI step 1 (facts): business profile, every item cites page + quote
   │◀── {status: completed, result} ─────────┘    ├─ verify: cited page exists and quote is really on it; else drop
   ▼                                              ├─ AI step 2 (inference): ICP, UVP, voice, goals, grounded in fact ids
review/edit → approve → Supabase                  ├─ verify: differentiators need facts; strip fake precision
(approved tables)                                 └─ store: business_analyses (versioned suggestion) + crawled_pages
```

### API (`apps/api`)

```
src/crawler/     url.ts (normalize, dedupe keys) · ssrf.ts (IP/host checks, connect-time DNS guard)
                 fetcher.ts (SafeFetcher) · robots.ts · prioritize.ts · extract.ts · crawl.ts
src/analysis/    evidence.ts · schema.ts (zod → strict JSON schema) · verify.ts (guardrails)
                 prompts/profile.ts · prompts/positioning.ts (versioned prompts, not inline strings)
                 providers/AIProvider.ts (vendor-neutral) · providers/OpenAIProvider.ts
                 pipeline.ts · types.ts (the API contract)
src/store/       AnalysisStore interface · PostgresAnalysisStore · MemoryAnalysisStore
src/jobs/        AnalysisJobRunner (background jobs, concurrency cap, timeout, stale-job recovery)
src/http/        app.ts (routes) · auth.ts (Supabase token check / dev header)
```

**Endpoints** (all require auth; an analysis you don't own returns 404):
- `POST /business/analyze {url, manual?}` returns `202 {jobId, status, version, …}`. Invalid or unsafe URLs are rejected with `400` before anything is queued. Rate limit: `429`.
- `GET /business/analysis/:id` returns `{status, phase, progress, error?, result?}`.
- `GET /business/analysis/:id/debug` returns crawled pages with extracted text, facts, rejected claims, warnings, timings, token usage, model, and prompt versions. It's off in production unless `DEBUG_ENDPOINTS=true`.

**Facts vs inferences.**
- *Facts* (`result.evidence`, plus the business name, services, products, locations, and service areas) are things the website states. Each one carries source URLs and a quote that the server confirmed appears on the page.
- *Inferences* (`result.inferences`, plus the audience, value proposition, voice, and industry category) are the AI's reasoning. Each one lists the fact ids it's based on.

Claims the model can't back up (a service that isn't on the site, a service area inferred from a city, an "award" with no quote) are dropped and recorded in `rejectedClaims`. Other checks:
- Differentiators without supporting facts are removed.
- Incomes, percentages, and fake-precise age ranges (like "37–52") are stripped.
- Generic filler ("high-quality", "customer-focused", …) that isn't on the site lowers confidence and adds a warning.

**LLM provider layer.**
- The pipeline only talks to `AIProvider.generateStructured({system, user, schema})`.
- `OpenAIProvider` uses Chat Completions with strict `json_schema` structured output, then validates again with zod. It retries on 429/5xx and asks the model to repair invalid output once.
- Adding Anthropic, Gemini, or another vendor means one new class. No prompt or pipeline changes.

**Why a Node service instead of Supabase Edge Functions?** SSRF-safe crawling needs a DNS check at connect time: the IP we actually connect to must be public, including after redirects and DNS rebinding. Node lets us plug that into the socket layer, and the Deno edge runtime doesn't. Long-running background jobs and local testability were secondary reasons. Hono keeps the HTTP layer portable if we move later.

### Mobile (`apps/mobile`)

```
src/app/            Routes only (Expo Router)
  (auth)/             sign-up, sign-in
  onboarding/         website → analyzing → business → audience → value → goals → voice → playbook
                      (+ manual: the "couldn't learn enough" fallback)
  (app)/              home (recommended ideas), idea/[id] sheet, profile sheet
  debug/analysis      developer-only analysis inspector
src/domain/         Types, labels, validation, onboarding model (applyAnalysis / approve)
src/services/
  analysis/           BusinessAnalysisService → Api (real) | Mock (demo)
  api/                API client + response types (mirror of apps/api/src/analysis/types.ts)
  recommendations/    RecommendationService → Mock
  auth/ · profile/    Supabase | Local (demo)
src/state/          AuthProvider, OnboardingProvider, IdeasProvider
```

- **Real progress.** The checklist ticks only on server milestones: crawl finished → facts extracted → positioning drafted → done.
- **Resumable.** The job id is saved as soon as the server accepts it. Closing the app mid-analysis and reopening it resumes polling the same job; it doesn't start a new one.
- **Local-first onboarding** (from Phase 1). Every edit is autosaved on the device, and each confirmed step is saved to the server.

### Dependencies added in Phase 2 (and why)

| Package | Where | Why |
| --- | --- | --- |
| `hono`, `@hono/node-server` | API | Small, fast HTTP framework that also runs on edge runtimes if we move. |
| `undici` | API | HTTP client that lets us plug the SSRF DNS check into the socket connector. |
| `cheerio` | API | Robust HTML parsing for content extraction and link discovery. |
| `pg` | API | Direct Postgres access for versioned analysis writes (transactions, advisory locks). |
| `zod` | API | Validates AI output and generates the strict JSON schema sent to the model. |
| `vitest`, `tsx`, `typescript` | API and app (dev only) | Tests and the TypeScript dev server. |

---

## Database

Migrations: `20260925000000_initial_schema.sql` (Phase 1) and `20261001000000_phase2_business_analysis.sql` (Phase 2).

```
auth.users 1─1 profiles
auth.users 1─* business_analyses   SUGGESTIONS (written by the API only). One row per run:
                                   status, phase, progress, version, pipeline_version, model,
                                   suggested_profile / suggested_audience / suggested_value_proposition,
                                   facts (evidence + sources), inferences, confidence, debug, timings
business_analyses 1─* crawled_pages url, page_type, priority, title, meta, h1, headings, content, JSON-LD
auth.users 1─* businesses          APPROVED profile + current_analysis_id, profile_approved_at,
                                   locations[], service_areas[], products[]
businesses 1─1 audience_profiles   APPROVED ICP: summary, structured_attributes, ai_suggested_summary,
                                   source_analysis_id, user_edited, approved_at
businesses 1─1 value_propositions  APPROVED UVP: summary, structured, ai_suggested_summary,
                                   source_analysis_id, user_edited, approved_at
businesses 1─1 content_preferences · content_playbooks · 1─* content_ideas   (Phase 1)
```

**Suggested vs approved (the critical rule).**
- `business_analyses` holds only AI suggestions. The API never writes the approved tables.
- The approved tables are written only when the user confirms a step. They record which analysis each section came from and whether the user edited it.
- Re-analyzing a site creates a new version (`version` 1, 2, 3 … per user and site).
- In the app, `applyAnalysis()` refreshes only the sections the user hasn't approved. Approved sections keep the user's text, and the new suggestion is offered as a one-tap **Use suggestion** / **Use them**.

This is covered by tests on both sides: the database integration test and the app's unit tests.

**RLS.** Users can read their own analyses and crawled pages, and can't insert or modify them. Only the server writes, over its privileged connection.

---

## Product flows (Phase 2 changes)

1. **Analyze.** The app POSTs the URL, gets a job id, and polls it. The checklist reflects real progress.
2. **Success.** The Business Profile, Ideal Customer, Value Proposition, Goals, and Voice screens are filled from the analysis. The user can edit everything, and confirming a step saves that section as approved.
3. **Failure** (site unreachable, blocked, not HTML, too little content, AI failure, timeout):
   - The app shows **"We couldn't learn enough from your website."** with **Tell us about your business**.
   - That opens four questions: name, what you do, customers, and what makes you different.
   - The same pipeline turns the answers into a profile, cited as `owner-provided`.
   - **Try again** and **Use a different website** are always available.
4. **Re-analyze (prepared, not yet exposed).** POST the same URL again to get version *n+1*. Approved data is untouched.
5. **Debug view** (dev builds only): crawled pages and their raw extracted text, facts with sources, AI inferences for the ICP and UVP with their fact trail, confidence, rejected claims, warnings, timings, and errors.

---

## Security

- **No secrets in the app.** Crawling and AI calls run server-side, and the app only sends a URL plus the user's Supabase token.
- **SSRF protection:**
  - http(s) only, standard ports only, no credentials in URLs, no IP literals (including decimal and hex forms), no localhost, `.local` or `.internal` hosts.
  - DNS is checked at connect time and rejects private, loopback, link-local/metadata (169.254.169.254), CGNAT, multicast, reserved, IPv6 ULA and link-local, and IPv4-mapped/NAT64 forms.
  - Redirects are followed manually and re-checked at every hop.
  - Tests include a real loopback server the fetcher must not reach.
- **Crawler limits:** 15 pages, depth 2, 10 s per request, 2 MB per response, a 45 s total budget, and 4 requests at a time. `robots.txt` is honored, cookies are never sent, and non-HTML is skipped.
- **Prompt injection:** website text is wrapped as untrusted data and the model is told to ignore instructions inside it. Output is schema-validated, and factual claims are checked against the page text.
- **Abuse:** a per-user hourly rate limit, a job concurrency cap, and a per-job timeout.

---

## Testing

```bash
cd apps/api && npm test          # 144 tests; the 6 Postgres integration tests are skipped without a database
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/reelwise_test npm test   # all 150, incl. migrations + RLS
cd apps/mobile && npm test       # domain tests: suggested vs approved, result mapping, progress
```

Covered:
- URL normalization, duplicate URLs (www, scheme, trailing slash, index.html, tracking params, canonical tags, identical content), and link discovery and resolution.
- SSRF (IP ranges, hostnames, a live loopback server, metadata addresses) and robots.txt.
- Page prioritization and exclusions, including per-type caps.
- Content extraction and boilerplate removal.
- Strict schema compatibility and AI output validation.
- Citation verification (hallucinations are dropped) and fake-precision stripping.
- OpenAIProvider retries, refusals, truncation, and repair.
- The full pipeline and failure codes, the HTTP API (auth, ownership, rate limits, versioning, debug gating), and Postgres persistence, versioning, approved-data protection, and RLS.

Fixture websites: a local plumber, a law firm, a wellness clinic, an ecommerce store, a restaurant, plus parked, robots-blocked, 403, PDF, and duplicate-URL sites.

`apps/api/test/e2e-server.ts` runs the real API with fixture sites and a stubbed LLM. The mobile web build has been driven through it end to end: the real analysis, the debug view, the manual fallback, resuming after a reload, and a blocked site. Screenshots are in `docs/phase-2-screenshots/`.

**Not yet verified:** crawling real websites and calling OpenAI live. The build sandbox had no outbound web access. Run `npm run analyze -- <url>` with a key before relying on it.
