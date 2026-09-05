@AGENTS.md

# FirstDram — project notes

Hackathon entry (Wanted AI Challenge 2026, deadline 2026-09-20, solo). Ship over polish; keep to the priority order in README.md.

## Conventions

- Next.js 16: `src/proxy.ts` (not middleware), async `params`/`searchParams`/`cookies()`, use generated `PageProps<"/route">` / `LayoutProps<"/">` helpers. No `next lint` — run `npx eslint .`.
- shadcn here is the **Base UI** flavor (`base-nova`), not Radix. There is no `asChild`; render as a link with `<Button render={<Link href="..." />}>label</Button>`.
- Supabase: `createClient()` from `@/lib/supabase/server` in Server Components/Actions/Route Handlers, `@/lib/supabase/client` in Client Components. Protected route prefixes live in `src/lib/supabase/proxy.ts`.
- All user-facing copy is Korean, casual-polite (~해요체), beginner-friendly — no unexplained whisky jargon.
- Whisky dictionary is static data in the repo (`src/data/`), not in Supabase. Only per-user state (profile vector, tasting notes, recommendation history) goes to the DB.
- Taste axes are shared between user profile (-2..+2) and whisky flavor (0..5): see `src/lib/whisky/types.ts`. Any new AI feature that touches taste should read/write those axes, not invent new ones.
- Whisky classification has three axes: **origin** (derived from `country` via `getOrigin()` in `src/lib/whisky/format.ts`, never stored), **type** (`WhiskyType`: production method), **styles** (`StyleTag[]`: sherry / peated / bourbon_cask / wine_cask / high_proof / highball, multiple allowed). When adding a whisky, always fill `styles` (empty array is fine but be deliberate). Labels/descriptions for all three live in `format.ts`.
- AI 호출은 **직접 SDK 를 쓰지 말고** `src/lib/ai/provider.ts` 의 `generateJson()` / `streamTurn()` 을 쓰세요. `AI_PROVIDER` 로 Claude·OpenAI·Gemini 를 바꿔 끼우기 때문이에요. 새 AI 기능도 이 두 함수 위에 올려요. 모든 기능에는 키가 없을 때 쓸 규칙 기반 폴백이 있어야 해요 (데모가 멈추면 안 돼요).
- Anthropic 쪽 코드를 직접 손볼 때만 `claude-api` 스킬을 먼저 읽어요. 구조화 출력은 자유 텍스트 파싱이 아니라 스키마로 받아요.
- 팝업 스토어는 사람이 바꾸는 정보라 **Supabase `popup_stores` 가 원본**이고, `src/data/popups.ts` 는 DB가 비었을 때 쓰는 예시 시드(`sample: true`)예요. 실제로 없는 행사를 사실처럼 쓰지 말고, 시드는 예시임을 UI에 표시해요. 캐치테이블·네이버는 공개 API가 없어서 크롤링하지 않고 링크만 이어줘요.
- 관리자 권한은 `public.admins` 테이블 + `admin_emails` 자동 승격이에요. 권한 확인은 `src/lib/auth/admin.ts` (`requireAdmin()`), 쓰기 권한은 RLS 의 `public.is_admin()` 으로 막아요.
- 지구본은 나라 → 지역 → 증류소 3단계이고, 마지막 단계에서는 고도에 맞춘 격자 클러스터로 핀이 겹치지 않게 해요 (`src/app/(app)/map/cluster.ts`). 육지 텍스처는 수륙 마스크에서 런타임에 만들어요 (`land-texture.ts`).

## Commands

- `npm run dev` / `npm run build` / `npx tsc --noEmit` / `npx eslint .`
- DB schema: `supabase/schema.sql` (run in Supabase SQL Editor; it is idempotent).
