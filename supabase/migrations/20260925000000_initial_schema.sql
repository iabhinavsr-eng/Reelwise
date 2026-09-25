-- Reelwise — initial schema (Phase 1: onboarding + recommended ideas)
--
-- Ownership model: auth.users 1─* businesses 1─1 {audience, value prop,
-- preferences, playbook} and 1─* {analyses, content ideas}. Every business-
-- scoped table is protected by RLS through businesses.user_id, so one user can
-- own many businesses later without schema changes.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- User profile (1─1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Business
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  website_url text not null,
  industry text not null default '',
  description text not null default '',
  primary_location text not null default '',
  services text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_user_id_idx on public.businesses (user_id);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- Raw output of each website analysis run. Kept so we can show what the AI
-- suggested, re-run analysis later, and move to async crawling jobs.
create table public.business_analyses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  website_url text not null,
  status text not null default 'succeeded'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  provider text not null,
  result jsonb,
  error text,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, analyzed_at)
);

-- ICP. Customer-facing: "Ideal Customer" / "Your Audience".
create table public.audience_profiles (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  summary text not null default '',
  ai_suggested_summary text,
  -- locations, age_ranges, customer_types, needs, pain_points, motivations,
  -- behaviors, preferences … (see AudienceAttributes in the app)
  structured_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger audience_profiles_updated_at before update on public.audience_profiles
  for each row execute function public.set_updated_at();

-- UVP. Customer-facing: "Why customers choose you".
create table public.value_propositions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  summary text not null default '',
  ai_suggested_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger value_propositions_updated_at before update on public.value_propositions
  for each row execute function public.set_updated_at();

create table public.content_preferences (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  goals text[] not null default '{}',        -- ContentGoal ids
  voice_traits text[] not null default '{}', -- VoiceTrait ids
  platforms text[] not null default '{instagram_reels}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger content_preferences_updated_at before update on public.content_preferences
  for each row execute function public.set_updated_at();

create table public.content_playbooks (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  onboarding_step text not null default 'website',
  onboarding_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger content_playbooks_updated_at before update on public.content_playbooks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Content ideas (the recommendation feed)
--
-- The future script engine combines: business context + audience + value
-- proposition + content_type + blueprint + objective + platform +
-- target_length_seconds + call_to_action. Those inputs live here (nullable)
-- so scripts / blueprints can be added as new tables referencing this one.
-- ---------------------------------------------------------------------------

create table public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  content_type text not null,  -- quick_tip, faq, myth_vs_fact, … (ContentType)
  title text not null,
  description text not null default '',
  status text not null default 'suggested'
    check (status in ('suggested', 'selected', 'scripted', 'recorded', 'published', 'dismissed')),
  objective text,              -- ContentGoal this idea serves
  platform text,
  target_length_seconds integer check (target_length_seconds > 0),
  call_to_action text,
  source text not null default 'system' check (source in ('system', 'ai', 'user')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_ideas_business_id_created_at_idx on public.content_ideas (business_id, created_at desc);
create trigger content_ideas_updated_at before update on public.content_ideas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_analyses enable row level security;
alter table public.audience_profiles enable row level security;
alter table public.value_propositions enable row level security;
alter table public.content_preferences enable row level security;
alter table public.content_playbooks enable row level security;
alter table public.content_ideas enable row level security;

create policy "Own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "Own businesses" on public.businesses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.owns_business(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = target and b.user_id = auth.uid());
$$;

create policy "Own business analyses" on public.business_analyses
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Own audience profiles" on public.audience_profiles
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Own value propositions" on public.value_propositions
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Own content preferences" on public.content_preferences
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Own content playbooks" on public.content_playbooks
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "Own content ideas" on public.content_ideas
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
