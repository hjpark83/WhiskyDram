# 🥃 FirstDram — 초보자를 위한 AI 위스키 소믈리에

> *Your first dram, chosen for you.*

> Wanted AI Challenge 2026 출품작

위스키를 처음 시작하는 사람이 겪는 진짜 문제는 "정보가 없어서"가 아니라
**"용어를 몰라서 정보를 읽어도 이해가 안 되고, 뭘 사야 할지 모르겠어서"** 입니다.
FirstDram은 전문 테이스팅 노트를 초보자의 언어로 번역하고, 마실수록 취향을 학습해
다음 한 병을 추천합니다.

## 핵심 기능

| 기능 | 설명 | AI 역할 |
|---|---|---|
| 취향 진단 | 일상 언어 질문 5~6개 → 취향 프로필 생성 → 입문 위스키 3병 추천 (이유·가격대·페어링 포함) | 프로필 → 추천 사유 생성 |
| 병 스캔 | 마트에서 찍은 병 사진 → 라벨 인식 → 내장 사전 매칭 → 쉬운 해설 + 내 취향 적합도 | Claude 비전으로 라벨 식별 |
| 테이스팅 노트 | "피트는 별로, 과일향이 좋았어요" 한 줄 후기 → 취향 프로필 갱신 → 재추천 | 자유 텍스트 → 취향 벡터 델타 추출 |
| 증류소 지도 | 추천 위스키의 고향을 지도에서 스토리와 함께 | — |
| 용어 사전 | 본문 속 전문 용어 클릭 → 팝업 설명 | — |

### 설계 포인트

취향 프로필과 위스키 향미 프로필이 **같은 축**(`peat / fruit / sweet / spice / floral / oak / body`)을 공유합니다.
진단 결과와 후기 분석 모두 이 벡터를 갱신하므로 추천 로직이 하나로 통일됩니다.
→ [`src/lib/whisky/types.ts`](src/lib/whisky/types.ts)

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (Base UI)
- **Supabase** — Auth (이메일/Google) + Postgres (RLS)
- **Claude API** (`@anthropic-ai/sdk`) — 추천 사유 생성, 비전 라벨 인식, 후기 분석
- **Vercel** — 배포

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

### 환경 변수

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `ANTHROPIC_API_KEY` | Anthropic API 키 (없으면 AI 없이 규칙 기반 추천으로 폴백) |
| `ANTHROPIC_MODEL` | (선택) 기본 `claude-opus-5` |
| `NEXT_PUBLIC_SITE_URL` | 인증 리다이렉트용 사이트 URL |

### Supabase 세팅

1. 새 프로젝트 생성 → **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql) 실행
2. **Authentication → Providers → Email**: 개발 편의상 *Confirm email* 끄기 (선택)
3. **Authentication → URL Configuration**: Site URL과 Redirect URLs에 `http://localhost:3000/auth/callback`, 배포 URL 추가
4. Google 로그인을 쓰려면 **Providers → Google** 활성화 후 OAuth 클라이언트 등록

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              # 랜딩
│   ├── login/                # 로그인/회원가입 (Server Actions)
│   ├── auth/                 # OAuth 콜백, 로그아웃
│   └── (app)/                # 로그인 필요 영역 (공통 헤더)
│       ├── home/             # 대시보드 (취향 프로필 + 최근 추천)
│       ├── quiz/             # 취향 진단 (7문항) → Server Action → Claude
│       ├── recommend/        # 최근 추천 결과 + 공유 버튼
│       ├── chat/             # AI 소믈리에 (스트리밍 + tool use)
│       ├── scan/             # 병 라벨 스캔 (Claude 비전)
│       ├── journal/          # 테이스팅 노트 → 취향 갱신
│       ├── map/              # 지구본 증류소 지도 (react-globe.gl)
│       ├── compare/          # 두 병 비교
│       ├── glossary/         # 용어 사전
│       └── whisky/           # 위스키 탐색 목록 + 상세 [id]
│   ├── share/                # 공개 공유 카드 (URL 파라미터 기반)
│   └── api/chat, api/og      # 채팅 스트림, OG 이미지
├── data/
│   ├── whiskies.ts           # 위스키 사전 (정적, 312병)
│   ├── distilleries.ts       # 증류소 메타 (108곳)
│   ├── glossary.ts           # 용어 사전
│   └── quiz.ts               # 진단 질문 + 축 델타
├── components/ui/            # shadcn
├── lib/
│   ├── ai/                   # Anthropic 클라이언트, 추천 사유 생성 (structured output)
│   ├── supabase/             # browser / server / proxy 클라이언트
│   └── whisky/               # 도메인 타입, 추천 점수 계산, 포맷 헬퍼
└── proxy.ts                  # 세션 갱신 + 보호 라우트 리다이렉트
supabase/schema.sql           # DB 스키마 (profiles, tasting_notes, recommendations)
```

## 로드맵

- [x] P0 · 프로젝트 세팅, 인증, 배포 파이프라인
- [x] P0 · 위스키 사전 데이터 (312병, `src/data/whiskies.ts`)
- [x] P0 · 취향 진단 → AI 추천 (`/quiz` → `/recommend`) + 위스키 탐색 (`/whisky`)
- [x] P1 · 병 스캔 (Claude 비전, `/scan`)
- [x] P1 · 테이스팅 노트 → 취향 갱신 → 재추천 (`/journal`)
- [x] P1 · AI 소믈리에 채팅 (사전 검색 tool use, `/chat`)
- [x] P2 · 지구본 증류소 지도 (`/map`), 용어 사전·팝오버 (`/glossary`), 두 병 비교 (`/compare`), 공유 카드 (`/share`, OG 이미지)
- [ ] P2 · 데모 영상, 발표 자료

## 데모 시나리오 (3분)

1. **랜딩 → 로그인 → 취향 진단** (`/quiz`): 라떼·과일 타르트·연기 싫음·5만 원 이하로 답하면 "달콤한 과일파" + 3병. 추천 이유가 답변을 인용하는지 보여주기.
2. **결과 공유** (`/recommend` → 공유하기): 링크를 열면 OG 카드가 뜨는 걸 보여주기.
3. **AI 소믈리에** (`/chat`): "삼겹살이랑 5만 원대" → 사전 검색 후 카드가 인라인으로 뜸.
4. **병 스캔** (`/scan`): 폰으로 라벨 촬영 → 병 인식 + "내 취향 xx%" 판정.
5. **테이스팅 노트** (`/journal`): 라프로익 10 ★5 "연기가 계속 생각나요" → 프로필 델타 칩 + 다음 3병 (쿼터 캐스크 등 사다리).
6. **지구본** (`/map`): 아일라 섬으로 날아가 점 클릭 → 증류소 이야기 + 병 목록. 취향 색으로 "내 취향은 아일라에 몰려 있네".
7. **용어 팝오버·비교**: 상세 페이지에서 "셰리 캐스크" 클릭, "다른 병과 비교".

## 구조 메모

- 추천 점수: `src/lib/whisky/recommend.ts` (취향 -2..+2 · 향미 0..5 내적, 예산·난이도 필터, 증류소 다양성)
- AI 호출: `src/lib/ai/*` — 모두 structured output(zod) 또는 tool use. API 키 없으면 규칙 기반 폴백으로 데모가 멈추지 않아요.
- 분류 3축: 원산지(파생) · 종류 · 스타일 태그. 라벨은 `src/lib/whisky/format.ts`.
