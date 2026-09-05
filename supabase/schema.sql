-- FirstDram (AI Whisky Sommelier) — Supabase schema
-- Run this in Supabase Dashboard > SQL Editor. It is idempotent — re-run it
-- whenever this file changes (policies are dropped and recreated).
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

drop policy if exists "profiles: owner can read" on public.profiles;
create policy "profiles: owner can read"
  on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: owner can insert" on public.profiles;
create policy "profiles: owner can insert"
  on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles: owner can update" on public.profiles;
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

drop policy if exists "tasting_notes: owner full access" on public.tasting_notes;
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

drop policy if exists "recommendations: owner full access" on public.recommendations;
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

-- ---------------------------------------------------------------------------
-- admins: 관리자 계정
--   · admin_emails 에 적어둔 이메일로 가입하면 자동으로 관리자가 돼요.
--   · 이미 가입한 계정을 관리자로 올리려면 이 파일 맨 아래 스니펫을 쓰세요.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

-- RLS 를 켜고 정책을 안 만들어요 → 앱에서는 아무도 못 읽어요.
-- 아래 security definer 함수/트리거만 이 표를 봐요 (관리자 명단이 새지 않게).
alter table public.admin_emails enable row level security;

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- 관리자인지 확인하는 헬퍼 (정책 안에서 재귀하지 않도록 security definer)
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = uid);
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;

-- 자기 관리자 여부만 확인 가능. 승격/해제는 SQL Editor(service role)에서만.
drop policy if exists "admins: read own row" on public.admins;
create policy "admins: read own row"
  on public.admins for select using (auth.uid() = user_id);

-- 가입 시 프로필 생성 + 관리자 이메일이면 자동 승격
--   닉네임은 가입 폼에서 받은 값(raw_user_meta_data.display_name)을 먼저 쓰고,
--   구글 로그인은 구글이 준 이름(full_name / name)을, 둘 다 없으면 이메일 아이디를 써요.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  if exists (
    select 1 from public.admin_emails e
    where lower(e.email) = lower(new.email)
  ) then
    insert into public.admins (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- popup_stores: 브랜드 팝업 스토어 (관리자가 등록, 모든 사용자가 열람)
-- 비어 있으면 앱이 src/data/popups.ts 의 예시 시드를 보여줘요.
-- ---------------------------------------------------------------------------
create table if not exists public.popup_stores (
  id text primary key,
  brand text not null,
  brand_en text not null default '',
  title text not null,
  summary text not null default '',
  description text not null default '',
  highlights text[] not null default '{}',
  venue text not null default '',
  address text not null default '',
  city text not null default '',
  start_date date not null,
  end_date date not null,
  hours text not null default '',
  entry text not null default '',
  reservation text not null default 'walkin'
    check (reservation in ('catchtable', 'naver', 'instagram', 'walkin')),
  links jsonb not null default '[]'::jsonb,   -- [{ kind, label, url }]
  whisky_ids text[] not null default '{}',    -- src/data/whiskies.ts 의 id
  tags text[] not null default '{}',
  accent text not null default '#d9a441',
  image_url text not null default '',        -- 대표 사진 (관리자가 넣어요)
  published boolean not null default true,
  -- AI 가 웹 검색으로 만든 초안인지. true 면 관리자가 출처를 확인하고 공개해요.
  ai_generated boolean not null default false,
  sources jsonb not null default '[]'::jsonb,   -- ["https://…"] 근거 주소
  ai_note text,                                  -- 무엇을 확인해야 하는지
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- 이전 버전으로 표를 이미 만들었다면 컬럼만 채워줘요
alter table public.popup_stores add column if not exists ai_generated boolean not null default false;
alter table public.popup_stores add column if not exists sources jsonb not null default '[]'::jsonb;
alter table public.popup_stores add column if not exists ai_note text;
alter table public.popup_stores add column if not exists image_url text not null default '';

create index if not exists popup_stores_period_idx on public.popup_stores (end_date desc, start_date desc);

alter table public.popup_stores enable row level security;

drop policy if exists "popup_stores: everyone reads published" on public.popup_stores;
create policy "popup_stores: everyone reads published"
  on public.popup_stores for select
  using (published or public.is_admin());

drop policy if exists "popup_stores: admin writes" on public.popup_stores;
create policy "popup_stores: admin writes"
  on public.popup_stores for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists popup_stores_set_updated_at on public.popup_stores;
create trigger popup_stores_set_updated_at
  before update on public.popup_stores
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 관리자 지정 (여기만 본인 것으로 바꿔서 실행하세요)
-- ---------------------------------------------------------------------------
-- 1) 이 이메일로 가입하면 자동으로 관리자가 돼요 (다시 가입하거나 계정을 옮길 때 대비).
insert into public.admin_emails (email, note)
values ('junippini83@naver.com', '사이트 운영자')
on conflict (email) do nothing;

-- 2) 이미 가입한 계정을 지금 바로 관리자로 올려요.
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('junippini83@naver.com')
on conflict (user_id) do nothing;

-- 운영자를 더 추가하려면 위 두 줄의 이메일만 바꿔서 다시 실행하세요.
