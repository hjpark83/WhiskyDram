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
-- 내 정보 (profiles 에 덧붙이는 칸)
-- ---------------------------------------------------------------------------
-- 추천에 쓰는 것과 안 쓰는 것을 나눠뒀어요 (src/data/persona.ts 참고).
--   drink_scenes / likes_note / avoids_note → 추천 프롬프트에 들어가요.
--   age_band → 도수·가격 감각 참고용. "이 나이대는 이렇다" 단정은 금지.
--   gender   → 저장만 하고 추천 계산·프롬프트에는 넣지 않아요.
alter table public.profiles add column if not exists age_band text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists drink_scenes text[] not null default '{}'::text[];
alter table public.profiles add column if not exists likes_note text;
alter table public.profiles add column if not exists avoids_note text;

-- ---------------------------------------------------------------------------
-- 시세 제보 (price_reports)
-- ---------------------------------------------------------------------------
-- 왜 제보인가: 한국은 주류 통신판매가 원칙적으로 금지라 마트·매장이 위스키 가격을
-- 온라인에 올리지 않아요. 긁어올 원본이 아예 없어서, 애호가들은 서로 "어디서 얼마"
-- 를 알려주며 시세를 파악해요. 그 방식을 그대로 옮긴 표예요.
--
-- 가격은 용량이 다르면 비교가 안 되니(코스트코 1L 등) 용량을 함께 받고,
-- 화면에서는 700ml 기준으로 환산한 값으로 비교해요.
create table if not exists public.price_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  whisky_id text not null,                 -- src/data/whiskies.ts 의 id
  store text not null,                     -- src/data/stores.ts 의 id
  store_note text,                         -- 지점명 등 (예: "월평점")
  price_krw integer not null check (price_krw between 5000 and 5000000),
  volume_ml integer not null default 700 check (volume_ml between 200 and 4500),
  seen_on date not null,
  note text,
  created_at timestamptz not null default now(),
  -- 같은 사람이 같은 날 같은 매장의 같은 병을 두 번 올리는 것만 막아요
  unique (user_id, whisky_id, store, seen_on)
);

create index if not exists price_reports_whisky_idx
  on public.price_reports (whisky_id, seen_on desc);
create index if not exists price_reports_recent_idx
  on public.price_reports (seen_on desc, created_at desc);

alter table public.price_reports enable row level security;

-- 시세는 다 같이 보는 정보예요 (로그인 안 해도 읽혀요)
drop policy if exists "price_reports: everyone reads" on public.price_reports;
create policy "price_reports: everyone reads"
  on public.price_reports for select
  using (true);

drop policy if exists "price_reports: owner inserts" on public.price_reports;
create policy "price_reports: owner inserts"
  on public.price_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "price_reports: owner updates" on public.price_reports;
create policy "price_reports: owner updates"
  on public.price_reports for update
  using (auth.uid() = user_id);

-- 본인 제보는 본인이, 엉터리 제보는 관리자가 지울 수 있어요
drop policy if exists "price_reports: owner or admin deletes" on public.price_reports;
create policy "price_reports: owner or admin deletes"
  on public.price_reports for delete
  using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- 관리자용 조회
-- ---------------------------------------------------------------------------
-- RLS 때문에 관리자도 남의 profiles·notes 를 직접 읽을 수 없어요 (그게 맞아요 —
-- 개인 기록이니까요). 그래서 **숫자만** 돌려주는 함수를 두고, 함수 안에서
-- 관리자인지 확인해요. 개별 사용자의 취향이나 후기 내용은 여기서도 안 나와요.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있어요' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'usersNew7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'profiles', (select count(*) from public.profiles),
    'withTaste', (select count(*) from public.profiles where taste_profile <> '{}'::jsonb),
    'withPersona', (select count(*) from public.profiles
                    where age_band is not null
                       or coalesce(array_length(drink_scenes, 1), 0) > 0
                       or likes_note is not null
                       or avoids_note is not null),
    'notes', (select count(*) from public.tasting_notes),
    'notes7d', (select count(*) from public.tasting_notes where created_at > now() - interval '7 days'),
    'recommendations', (select count(*) from public.recommendations),
    'priceReports', (select count(*) from public.price_reports),
    'priceReports7d', (select count(*) from public.price_reports where created_at > now() - interval '7 days'),
    'pricedWhiskies', (select count(distinct whisky_id) from public.price_reports),
    'admins', (select count(*) from public.admins)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

-- 가장 많이 기록된 위스키 (관리자 화면의 "무엇이 인기 있나")
create or replace function public.admin_top_whiskies(limit_count int default 10)
returns table (whisky_id text, notes bigint, avg_rating numeric)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있어요' using errcode = '42501';
  end if;

  return query
  select n.whisky_id, count(*) as notes, round(avg(n.rating), 1) as avg_rating
  from public.tasting_notes n
  group by n.whisky_id
  order by count(*) desc, n.whisky_id
  limit greatest(1, least(limit_count, 50));
end;
$$;

revoke all on function public.admin_top_whiskies(int) from public;
grant execute on function public.admin_top_whiskies(int) to authenticated;

-- 관리자는 시세 제보 전체를 보고 지울 수 있어야 해요 (엉터리 제보 정리).
-- 읽기는 이미 공개라 따로 정책이 필요 없고, 삭제 정책은 위에 있어요.

-- 이미 가입한 계정을 관리자로 올리고 내리는 함수.
-- auth.users 는 앱에서 직접 못 읽어서(그게 맞아요), 함수 안에서만 이메일을 찾아요.
create or replace function public.admin_promote_email(target_email text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  moved int;
begin
  if not public.is_admin() then
    raise exception '관리자만 쓸 수 있어요' using errcode = '42501';
  end if;

  insert into public.admins (user_id)
  select id from auth.users where lower(email) = lower(target_email)
  on conflict (user_id) do nothing;

  get diagnostics moved = row_count;
  return moved;
end;
$$;

create or replace function public.admin_revoke_email(target_email text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  moved int;
begin
  if not public.is_admin() then
    raise exception '관리자만 쓸 수 있어요' using errcode = '42501';
  end if;

  -- 자기 자신은 못 내려요 (관리자가 0명이 되면 아무도 못 들어가요)
  delete from public.admins a
  using auth.users u
  where a.user_id = u.id
    and lower(u.email) = lower(target_email)
    and a.user_id <> auth.uid();

  get diagnostics moved = row_count;
  return moved;
end;
$$;

revoke all on function public.admin_promote_email(text) from public;
revoke all on function public.admin_revoke_email(text) from public;
grant execute on function public.admin_promote_email(text) to authenticated;
grant execute on function public.admin_revoke_email(text) to authenticated;

-- 관리자 명단 관리: 관리자는 명단 전체를 보고 추가할 수 있어요.
drop policy if exists "admins: admin reads all" on public.admins;
create policy "admins: admin reads all"
  on public.admins for select using (public.is_admin());

drop policy if exists "admin_emails: admin reads" on public.admin_emails;
create policy "admin_emails: admin reads"
  on public.admin_emails for select using (public.is_admin());

drop policy if exists "admin_emails: admin writes" on public.admin_emails;
create policy "admin_emails: admin writes"
  on public.admin_emails for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- whisky_photos: 사용자가 찍은 실물 병 사진
--
--   판매 사이트 제품 이미지는 수입사·유통사 자산이라 가져다 쓸 수 없어요.
--   대신 사용자가 직접 찍은 사진은 그 사람 것이라, 스캔할 때 올린 사진을
--   그 병의 사진으로 쌓아요.
--
--   공개는 사람이 확인한 뒤에 해요 (approved). 남이 볼 화면에 올라가는
--   사진이라, AI 가 찾아온 정보와 같은 원칙을 지켜요. 다만 **올린 본인은
--   승인 전에도 자기 사진을 봐요** — 방금 올렸는데 안 보이면 고장 같으니까요.
-- ---------------------------------------------------------------------------
create table if not exists public.whisky_photos (
  id uuid primary key default gen_random_uuid(),
  whisky_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Storage 의 bottle-photos 버킷 안 경로
  storage_path text not null unique,
  -- scan = 병 스캔에서 자동으로, upload = 직접 올림
  source text not null default 'scan' check (source in ('scan', 'upload')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists whisky_photos_whisky_idx
  on public.whisky_photos (whisky_id, approved, created_at desc);
create index if not exists whisky_photos_pending_idx
  on public.whisky_photos (approved, created_at desc);

alter table public.whisky_photos enable row level security;

-- 승인된 사진은 누구나, 승인 전 사진은 올린 본인과 관리자만.
drop policy if exists "whisky_photos: approved or own" on public.whisky_photos;
create policy "whisky_photos: approved or own"
  on public.whisky_photos for select
  using (approved or user_id = auth.uid() or public.is_admin());

drop policy if exists "whisky_photos: owner inserts" on public.whisky_photos;
create policy "whisky_photos: owner inserts"
  on public.whisky_photos for insert
  to authenticated
  with check (user_id = auth.uid());

-- 승인은 관리자만. 본인이 approved 를 켜지 못하게 update 권한을 안 줘요.
drop policy if exists "whisky_photos: admin updates" on public.whisky_photos;
create policy "whisky_photos: admin updates"
  on public.whisky_photos for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "whisky_photos: owner or admin deletes" on public.whisky_photos;
create policy "whisky_photos: owner or admin deletes"
  on public.whisky_photos for delete
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: bottle-photos 버킷
--   경로 규칙은 "<user_id>/<whisky_id>/<uuid>.jpg" 예요. 정책이 첫 칸을
--   사용자 id 로 확인하니, 남의 폴더에는 못 올려요.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bottle-photos', 'bottle-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "bottle-photos: public read" on storage.objects;
create policy "bottle-photos: public read"
  on storage.objects for select
  using (bucket_id = 'bottle-photos');

drop policy if exists "bottle-photos: owner uploads" on storage.objects;
create policy "bottle-photos: owner uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bottle-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "bottle-photos: owner or admin deletes" on storage.objects;
create policy "bottle-photos: owner or admin deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'bottle-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- posts / post_comments: 공개 후기 글과 댓글
--
--   tasting_notes 와 다른 것이에요. 노트는 **나만 보는 기록**이고 취향 벡터를
--   갱신하는 데 써요. 여기 글은 **남에게 보여주는 글**이라 서로 섞지 않아요.
--   같은 병에 대해 노트도 쓰고 글도 쓸 수 있어요.
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 특정 병에 대한 글이면 그 id (자유 주제 글이면 비워둬요)
  whisky_id text,
  title text not null,
  body text not null,
  -- 별점은 선택이에요. 후기가 아니라 "요즘 마신 것들" 같은 글도 있으니까요.
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_recent_idx on public.posts (created_at desc);
create index if not exists posts_whisky_idx on public.posts (whisky_id, created_at desc);
create index if not exists posts_author_idx on public.posts (user_id, created_at desc);

alter table public.posts enable row level security;

drop policy if exists "posts: everyone reads" on public.posts;
create policy "posts: everyone reads" on public.posts for select using (true);

drop policy if exists "posts: owner inserts" on public.posts;
create policy "posts: owner inserts"
  on public.posts for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "posts: owner updates" on public.posts;
create policy "posts: owner updates"
  on public.posts for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "posts: owner or admin deletes" on public.posts;
create policy "posts: owner or admin deletes"
  on public.posts for delete using (user_id = auth.uid() or public.is_admin());

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "post_comments: everyone reads" on public.post_comments;
create policy "post_comments: everyone reads"
  on public.post_comments for select using (true);

drop policy if exists "post_comments: owner inserts" on public.post_comments;
create policy "post_comments: owner inserts"
  on public.post_comments for insert to authenticated with check (user_id = auth.uid());

-- 글쓴이도 자기 글에 달린 댓글을 지울 수 있어요 (자기 글은 자기가 관리해요).
drop policy if exists "post_comments: owner author or admin deletes" on public.post_comments;
create policy "post_comments: owner author or admin deletes"
  on public.post_comments for delete
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
  before update on public.posts
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 글쓴이 이름만 꺼내오는 함수
--
--   profiles 는 본인만 읽을 수 있어요 (취향 벡터·진단 답변이 들어 있으니까요).
--   그렇다고 글 목록에 이름을 못 띄우면 안 되니, **이름만** 돌려주는 함수를
--   따로 둬요. 표 전체를 열지 않고 필요한 칸만 꺼내는 거예요.
-- ---------------------------------------------------------------------------
create or replace function public.author_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
security definer set search_path = public
stable
as $$
  select p.id, p.display_name from public.profiles p where p.id = any(ids);
$$;

revoke all on function public.author_names(uuid[]) from public;
grant execute on function public.author_names(uuid[]) to authenticated, anon;

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
