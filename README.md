# Reelwise

An AI-first short-form video marketing app for small and medium-sized businesses.

> Tell us about your business once, and we'll keep telling you what to talk about on camera.

**Phase 1 (this code):** account creation → business URL → AI analysis → review/edit the business profile, ideal customer, and value proposition → choose content goals and voice → review the Content Playbook → land on recommended reel ideas.

Not built yet: recording, editing, publishing, and the script engine.

---

## Repository layout

```
apps/mobile/          Expo + React Native + TypeScript app (iOS-first, Android-ready)
supabase/
  migrations/         Postgres schema + row-level security
  functions/          Edge Functions (server-side AI/crawling lives here)
  config.toml         Supabase CLI local config
artifacts/reelwise/   Reelwise design tokens (source of truth for colors/radius)
artifacts/, lib/, …   Pre-existing Replit pnpm-workspace scaffold (unused by the app)
```

**Why `apps/mobile` sits outside the pnpm workspace:** the root `pnpm-workspace.yaml` is tuned for Replit's Linux containers. It strips macOS native binaries (esbuild, lightningcss, …), and Metro needs those binaries on a Mac. So the mobile app keeps its own `package.json` and `package-lock.json` and is installed with npm.

---

## Running the app

Requirements: Node 20+, and either the **Expo Go** app on an iPhone or Xcode with the iOS Simulator.

```bash
cd apps/mobile
npm install
npx expo start          # scan the QR code with your iPhone camera (Expo Go)
# or: npx expo start --ios   (Simulator)
```

With no configuration, the app runs in **local demo mode**. Accounts and profiles are stored on the device, and analysis and recommendations use realistic mock data. You can walk through the entire flow without setting up a backend.

Useful checks:

```bash
npm run typecheck                        # tsc --noEmit
npx expo export --platform ios           # full Metro production bundle
npx expo start --web                     # quick browser preview at phone width
```

Tips for trying the flow:
- The mock analysis picks an industry from keywords in the URL. For example, `lyteguards-wellness.com` gives wellness/IV therapy, `brightsmile-dental.com` gives dental, `cozy-hvac.com` gives home services, and `corefit-studio.com` gives fitness. Any other URL gets a generic local business.
- A URL containing `offline` (e.g. `offline-test.com`) simulates a network failure so you can see the error and retry states.
- Kill the app partway through onboarding and reopen it. You resume on the same step.

### Connecting Supabase (optional)

1. Create a Supabase project. For local development you can run `supabase start` instead.
2. Apply the schema: `supabase db push`, or paste `supabase/migrations/*.sql` into the SQL editor.
3. For development, turn off **Auth → Email → Confirm email**. If you leave it on, the app shows a "check your inbox" state and then asks the user to sign in.
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and fill in the values.
5. Optional: deploy the Edge Function (`supabase functions deploy analyze-business`) and set `EXPO_PUBLIC_ANALYSIS_PROVIDER=edge`.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env.local` | Supabase project URL. Leave it empty for demo mode. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env.local` | Public anon key. It's safe in the client because RLS enforces access. |
| `EXPO_PUBLIC_ANALYSIS_PROVIDER` | `apps/mobile/.env.local` | `mock` (default) or `edge` |
| `ANTHROPIC_API_KEY`, crawler keys, … (future) | `supabase secrets set …` | **Server-only.** Never add these to the app. |

Anything prefixed `EXPO_PUBLIC_` is compiled into the app bundle and should be treated as public. Every secret belongs in Edge Function secrets. `.env` and `.env*.local` are git-ignored.

---

## Architecture

```
src/app/            Routes only (Expo Router). One file per screen.
  _layout.tsx         Providers: SafeArea → Auth → Onboarding
  (auth)/             sign-up, sign-in
  onboarding/         website → analyzing → business → audience → value → goals → voice → playbook
  (app)/              home (recommended ideas), idea/[id] sheet, profile sheet
src/components/     ui/ (Button, TextField, Chip, Card, Notice, …) and flow-specific pieces
src/domain/         Types, labels, validation, onboarding step model. No React, no I/O.
src/services/       Interfaces + implementations, selected in each folder's index.ts
  analysis/           BusinessAnalysisService → Mock | EdgeFunction
  recommendations/    RecommendationService → Mock
  auth/               AuthService → Supabase | Local (demo)
  profile/            ProfileRepository → Supabase | Local (demo)
src/state/          AuthProvider, OnboardingProvider, IdeasProvider
src/theme/          Colors, spacing, radius, type scale (mirrors artifacts/reelwise/tokens.json)
```

Principles:
- **Screens never contain business logic or I/O.** They call providers, and providers call service interfaces. Replacing a mock means writing a new class that implements the interface and switching to it in the folder's `index.ts`. No UI code changes.
- **Routing has one rule.** `useGate()` works out whether the user belongs in `auth`, `onboarding`, or `app`. Each route group's layout redirects if the user belongs somewhere else. When onboarding finishes, the gate moves the user to their ideas automatically.
- **Onboarding is local-first.** Every edit is autosaved to an on-device cache (AsyncStorage). Confirming a step also saves it to the repository (Supabase). If that save fails, the user sees an inline error with retry, and nothing typed is lost. On launch, the newer of the device copy and the server copy wins.
- **Android later:** the app uses only cross-platform React Native and Expo modules, safe-area-aware layouts, and no iOS-only APIs. `npx expo start --android` should work, but Android hasn't been tested or visually checked yet.

### Dependencies added (and why)

| Package | Why |
| --- | --- |
| `expo-router` + `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants` | File-based navigation with native stack transitions. These are expo-router's required peer packages. |
| `@supabase/supabase-js`, `react-native-url-polyfill` | Auth and database client. The polyfill is Supabase's documented requirement on React Native. |
| `@react-native-async-storage/async-storage` | Persists the Supabase session and the onboarding draft so onboarding can resume. |
| `expo-haptics` | Subtle native tap and selection feedback. |
| `@expo/vector-icons` | Icons. Bundled with Expo, so no native build is needed. |
| `react-native-web`, `react-dom`, `@expo/metro-runtime` | Browser preview for quick checks and automated screenshots. The app doesn't need them at runtime. |

Everything is in Expo Go, so no custom native build is required yet. Versions are pinned to the SDK 57 compatibility list.

---

## Database

`supabase/migrations/20260925000000_initial_schema.sql`

```
auth.users 1─1 profiles (full_name; auto-created on sign-up)
auth.users 1─* businesses (name, website_url, industry, description, primary_location, services[])
businesses 1─* business_analyses   raw AI output per run (status, provider, result jsonb)
businesses 1─1 audience_profiles   ICP: summary, ai_suggested_summary, structured_attributes jsonb
businesses 1─1 value_propositions  UVP: summary, ai_suggested_summary
businesses 1─1 content_preferences goals[], voice_traits[], platforms[]
businesses 1─1 content_playbooks   onboarding_step, onboarding_completed, completed_at
businesses 1─* content_ideas       content_type, title, description, status, objective,
                                   platform, target_length_seconds, call_to_action, source, metadata
```

- **Multiple businesses per user:** everything hangs off `business_id`. The Phase 1 UI uses the user's first business.
- **RLS on every table:** users only see rows for businesses they own (`owns_business()`). This was checked against Postgres 16: cross-user reads return nothing and cross-user inserts are rejected.
- `structured_attributes` holds locations, age ranges, customer types, needs, pain points, motivations, behaviors, and preferences. Analysis can fill these in, but the user is never asked to type them.
- `ai_suggested_*` keeps the original AI draft next to the user's edits. That supports a "Use suggestion" action and future learning from edits.

### Prepared for the content engine

The script engine will combine business context, the ideal customer (ICP), the value proposition (UVP), content type, blueprint, marketing objective, platform, target length, and CTA into a teleprompter script. Most of these inputs already exist:
- Business, ICP, UVP, goals, and voice come from the Content Playbook.
- `content_ideas` already has `content_type` (all 14 types are listed in `src/domain/types.ts`), `objective`, `platform`, `target_length_seconds`, and `call_to_action`.
- Planned additions are new tables only: `content_blueprints` (structures for each content type) and `scripts` (`content_idea_id`, `blueprint_id`, body, version). Existing tables don't need to change.

---

## Product flows

1. **Create account.** Name, email, and password, validated on submit and then live after the first attempt. Errors are friendly, and there's a sign-in link for returning users.
2. **Website.** Accepts `mybiz.com`, `www.mybiz.com`, or a full URL, and normalizes it to https.
3. **Analysis.** A five-stage checklist ticks off as the `BusinessAnalysisService` reports progress. Failures offer **Try again** or **Use a different website**. If the analysis succeeded but the save failed, retrying skips the analysis and only retries the save.
4. **Business profile.** Every field the AI drafted is editable, and services are removable tags.
5. **Ideal customer** and **6. Value proposition.** An "AI suggested" draft that the user can edit. Once edited, the label changes to "Edited by you" and a one-tap **Use suggestion** appears.
7. **Goals** and **8. Voice.** Multi-select chips, with the AI's suggestions pre-selected so the user confirms instead of starting from scratch.
9. **Content Playbook.** Summary cards, each with **Edit**. An edit opens that step in review mode (**Save changes** returns to the Playbook). **Start creating** marks onboarding complete.
10. **Home.** "What should we talk about today?" with three recommended reel cards (loading skeletons, error with retry, empty state, "Show me more ideas"). **Create this reel** opens the idea sheet, where the teleprompter script will plug in next.

Customer-facing language never uses "ICP" or "UVP". The UI says *Ideal customer / Your audience* and *Why should they choose you / What makes you different*.
