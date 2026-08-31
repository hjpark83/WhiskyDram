-- FirstDram (AI Whisky Sommelier) — Supabase schema
-- Run this in Supabase Dashboard > SQL Editor.
-- Whisky dictionary itself lives in the repo as static data (src/data/whiskies.ts);
-- only per-user state is stored here.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holds the taste vector
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  taste_profile jsonb not null default '{}'::jsonb, -- { peat: -2..2, fruit: ..., body: ... }
  quiz_answers jsonb,                                -- raw answers from the last quiz
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner can insert"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner can update"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- tasting_notes: user reviews + AI analysis of each review
-- ---------------------------------------------------------------------------
create table if not exists public.tasting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  whisky_id text not null,            -- slug from the static dictionary
  rating smallint check (rating between 1 and 5),
  review text not null,
  ai_analysis jsonb,                  -- { deltas: {peat: -1, ...}, summary: "..." }
  created_at timestamptz not null default now()
);

create index if not exists tasting_notes_user_idx
  on public.tasting_notes (user_id, created_at desc);

alter table public.tasting_notes enable row level security;

create policy "tasting_notes: owner full access"
  on public.tasting_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recommendations: history of AI recommendations
-- ---------------------------------------------------------------------------
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('quiz', 'review', 'scan')),
  whisky_ids text[] not null,
  payload jsonb not null,             -- full AI response: reasons, pairings, etc.
  created_at timestamptz not null default now()
);

create index if not exists recommendations_user_idx
  on public.recommendations (user_id, created_at desc);

alter table public.recommendations enable row level security;

create policy "recommendations: owner full access"
  on public.recommendations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
