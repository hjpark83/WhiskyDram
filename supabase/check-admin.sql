-- 관리자 권한이 왜 안 붙었는지 확인하는 진단 쿼리.
-- Supabase → SQL Editor 에 붙여넣고 Run 하세요. 아무것도 바꾸지 않고 보기만 해요.

-- 1) 내 계정이 어떤 이메일로 들어가 있나?
--    구글로 로그인했다면 가입할 때 쓴 이메일과 다를 수 있어요.
select
  u.id,
  u.email,
  u.created_at,
  (u.raw_app_meta_data ->> 'provider') as 로그인_방식,
  exists (select 1 from public.admins a where a.user_id = u.id) as 관리자인가,
  exists (
    select 1 from public.admin_emails e where lower(e.email) = lower(u.email)
  ) as 관리자_명단에_있나
from auth.users u
order by u.created_at;

-- 2) 관리자 명단에 뭐가 들어 있나?
select * from public.admin_emails;

-- 3) 지금 관리자로 등록된 사람
select a.user_id, u.email
from public.admins a
join auth.users u on u.id = a.user_id;

-- ---------------------------------------------------------------------------
-- 고치기
-- ---------------------------------------------------------------------------
-- 위 1번에서 "관리자인가" 가 false 인 **내 이메일**을 아래 두 줄에 넣고 실행하세요.
-- (schema.sql 에 적힌 이메일과 실제 로그인 이메일이 다르면 승격이 안 돼요.)
--
-- insert into public.admin_emails (email, note)
-- values ('여기에@내이메일.com', '사이트 운영자')
-- on conflict (email) do nothing;
--
-- insert into public.admins (user_id)
-- select id from auth.users where lower(email) = lower('여기에@내이메일.com')
-- on conflict (user_id) do nothing;
--
-- 실행한 뒤 사이트에서 새로고침하면 /admin 이 열려요 (다시 로그인 안 해도 돼요).
