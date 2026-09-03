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
- Claude API code: load the `claude-api` skill before writing it; return structured JSON via tool use, not free text parsing.

## Commands

- `npm run dev` / `npm run build` / `npx tsc --noEmit` / `npx eslint .`
- DB schema: `supabase/schema.sql` (run in Supabase SQL Editor; it is idempotent).
