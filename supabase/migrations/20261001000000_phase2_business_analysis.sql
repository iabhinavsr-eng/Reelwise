-- Reelwise — Phase 2: real business analysis
--
-- SUGGESTED vs APPROVED
--   business_analyses  = AI suggestions. One row per analysis run (versioned),
--                        written only by the backend (service connection).
--   businesses, audience_profiles, value_propositions
--                      = the USER-APPROVED profile, written only when the user
--                        confirms a step. Re-analysis never touches these.

-- ---------------------------------------------------------------------------
-- business_analyses → versioned analysis jobs + suggestions
-- ---------------------------------------------------------------------------

alter table public.business_analyses alter column business_id drop not null;

alter table public.business_analyses
  add column user_id uuid references auth.users (id) on delete cascade,
  add column input_url text,
  add column normalized_url text,
  add column mode text not null default 'website' check (mode in ('website', 'manual')),
  add column manual_input jsonb,
  add column phase text check (phase in ('profile', 'positioning')),
  add column progress jsonb not null default '{}'::jsonb,
  add column error_code text,
  add column version integer not null default 1,
  add column pipeline_version text,
  add column model text,
  add column suggested_profile jsonb,
  add column suggested_audience jsonb,
  add column suggested_value_proposition jsonb,
  add column facts jsonb not null default '[]'::jsonb,
  add column inferences jsonb not null default '[]'::jsonb,
  add column confidence jsonb not null default '{}'::jsonb,
  add column debug jsonb,
  add column started_at timestamptz,
  add column completed_at timestamptz,
  add column duration_ms integer,
  add column updated_at timestamptz not null default now();

-- Backfill Phase 1 rows (which were always attached to a business).
update public.business_analyses a
set user_id = b.user_id,
    input_url = coalesce(a.input_url, a.website_url),
    normalized_url = coalesce(a.normalized_url, a.website_url)
from public.businesses b
where b.id = a.business_id;

delete from public.business_analyses where user_id is null;
alter table public.business_analyses alter column user_id set not null;

-- New job statuses.
alter table public.business_analyses drop constraint if exists business_analyses_status_check;
update public.business_analyses set status = case status
  when 'succeeded' then 'completed'
  when 'pending' then 'queued'
  when 'running' then 'analyzing'
  else status end;
alter table public.business_analyses
  add constraint business_analyses_status_check
  check (status in ('queued', 'crawling', 'analyzing', 'completed', 'failed'));
alter table public.business_analyses alter column status set default 'queued';
alter table public.business_analyses alter column provider set default 'openai';

create index business_analyses_user_created_idx on public.business_analyses (user_id, created_at desc);
create index business_analyses_user_url_idx on public.business_analyses (user_id, normalized_url, version desc);

create trigger business_analyses_updated_at before update on public.business_analyses
  for each row execute function public.set_updated_at();

-- Clients may READ their own analyses; only the backend writes them.
drop policy if exists "Own business analyses" on public.business_analyses;
create policy "Read own analyses" on public.business_analyses
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Crawled pages (source traceability + debug)
-- ---------------------------------------------------------------------------

create table public.crawled_pages (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.business_analyses (id) on delete cascade,
  url text not null,
  final_url text not null,
  page_type text not null,
  depth integer not null default 0,
  priority integer not null default 0,
  status_code integer,
  title text,
  meta_description text,
  h1 text,
  headings jsonb not null default '[]'::jsonb,
  content text not null default '',
  structured_data jsonb not null default '[]'::jsonb,
  content_chars integer not null default 0,
  fetched_at timestamptz not null default now()
);

create index crawled_pages_analysis_idx on public.crawled_pages (analysis_id);
alter table public.crawled_pages enable row level security;
create policy "Read own crawled pages" on public.crawled_pages
  for select using (exists (
    select 1 from public.business_analyses a where a.id = analysis_id and a.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Approved profile: provenance + structured fields
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column current_analysis_id uuid references public.business_analyses (id) on delete set null,
  add column locations text[] not null default '{}',
  add column service_areas text[] not null default '{}',
  add column products text[] not null default '{}',
  add column profile_approved_at timestamptz;

alter table public.audience_profiles
  add column source_analysis_id uuid references public.business_analyses (id) on delete set null,
  add column user_edited boolean not null default false,
  add column approved_at timestamptz;

alter table public.value_propositions
  add column structured jsonb not null default '{}'::jsonb, -- differentiators, problems_solved, benefits
  add column source_analysis_id uuid references public.business_analyses (id) on delete set null,
  add column user_edited boolean not null default false,
  add column approved_at timestamptz;
