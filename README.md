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
| 증류소 지도 | 지구본을 돌려 나라 → 지역 → 증류소로 좁혀가며 108곳을 탐색 | — |
| 팝업 스토어 | 브랜드 팝업 일정·내용 미리보기 + 캐치테이블·네이버 예약 링크, 관련 위스키 연결 | AI가 웹 검색으로 후보를 찾아 초안 작성 (관리자 확인 후 공개) |
| 용어 사전 | 본문 속 전문 용어 클릭 → 팝업 설명 | — |

### 설계 포인트

취향 프로필과 위스키 향미 프로필이 **같은 축**(`peat / fruit / sweet / spice / floral / oak / body`)을 공유합니다.
진단 결과와 후기 분석 모두 이 벡터를 갱신하므로 추천 로직이 하나로 통일됩니다.
→ [`src/lib/whisky/types.ts`](src/lib/whisky/types.ts)

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (Base UI)
- **Supabase** — Auth (이메일 / Google OAuth) + Postgres (RLS) + 관리자 권한
- **AI (교체 가능)** — Claude · ChatGPT(OpenAI) · Gemini 중 환경변수로 선택 → [`src/lib/ai/provider.ts`](src/lib/ai/provider.ts)
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
| `NEXT_PUBLIC_SITE_URL` | 인증 리다이렉트용 사이트 URL |
| `AI_PROVIDER` | (선택) `anthropic` / `openai` / `gemini` 중 강제 지정 |
| `ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` | Claude 키 / 모델 (기본 `claude-opus-5`) |
| `OPENAI_API_KEY` · `OPENAI_MODEL` | ChatGPT 키 / 모델 (기본 `gpt-5`) |
| `GEMINI_API_KEY` · `GEMINI_MODEL` | Gemini 키 / 모델 (기본 `gemini-2.5-flash`) |

키가 하나도 없어도 앱은 돌아가요 — 모든 AI 기능에 규칙 기반 폴백이 있어서 데모가 멈추지 않아요.
`/api/health` 를 열면 어떤 키가 잡혔고 지금 어떤 프로바이더가 쓰이는지 확인할 수 있어요.

### AI 프로바이더 바꾸기

AI 기능은 전부 두 가지 호출로 정리돼 있어요 (`src/lib/ai/provider.ts`).

| 함수 | 쓰는 곳 | 하는 일 |
|---|---|---|
| `generateJson()` | 취향 추천, 후기 분석, 병 스캔 | 스키마가 정해진 JSON 을 받아와요 (zod 로 검증) |
| `streamTurn()` | AI 소믈리에 채팅 | 도구를 쓰면서 글자를 스트리밍해요 |
| `researchWeb()` | 팝업 찾기 (`/admin/popups/discover`) | 모델이 직접 웹을 검색하고 출처를 돌려줘요 |

- **Claude**: 네이티브 SDK. `messages.parse()` + `zodOutputFormat` 으로 구조화 출력, 시스템 프롬프트는 프롬프트 캐싱.
- **ChatGPT**: `openai` SDK. `response_format: json_schema` (strict).
- **Gemini**: 같은 `openai` SDK 를 OpenAI 호환 엔드포인트(`generativelanguage.googleapis.com/v1beta/openai/`)로 붙여 써요.

바꾸는 방법은 키를 넣고 `AI_PROVIDER` 를 지정하는 것뿐이고, 기능 코드는 손대지 않아요.
스키마 모드를 못 받는 모델이면 JSON 모드로 자동 재시도해요.

웹 검색(`researchWeb`)은 프로바이더의 **검색 그라운딩**을 써요 — Gemini `google_search`,
OpenAI Responses API `web_search`, Claude `web_search` 서버 도구. 캐치테이블·네이버 HTML 을
직접 긁지 않아요 (약관 문제도 있고, 두 곳 다 봇 차단이 걸린 JS 페이지라 서버에서 긁으면 막혀요).

### Gemini API 키 받기

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 접속 → 구글 계정 로그인
2. **Create API key** → 기존 Google Cloud 프로젝트를 고르거나 새로 만들기
3. 만들어진 키(`AIza…`)를 복사
4. 로컬은 `.env.local`, 배포는 Vercel → Settings → Environment Variables 에 넣기

```
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash   # 선택. 품질을 올리려면 gemini-2.5-pro
```

무료 등급이 있지만 분당·하루 요청 수 제한이 있어요. 제한에 걸리면 앱은 규칙 기반 폴백으로
넘어가고, `/api/health` 에서 지금 어떤 프로바이더가 잡혔는지 확인할 수 있어요.

### AI 로 팝업 찾기

`/admin/popups/discover` 에서 브랜드를 적고 누르면 AI 가 웹을 검색해 팝업 후보를 정리해줘요.

- 결과는 **초안**이에요. 고른 항목은 `published: false` 로 저장되고, 관리자가 목록에서
  공개를 눌러야 사용자에게 보여요.
- AI 가 기간을 확인하지 못하면 날짜를 지어내지 않고 비워둬요. 관리자가 출처를 보고 채워야
  저장돼요.
- 저장된 초안에는 출처 URL 과 "확인할 점"이 함께 남고, 공개된 뒤에도 상세 페이지에 출처가
  보여요.

### Supabase 세팅

1. 새 프로젝트 생성 → **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql) 실행
2. **Authentication → Providers → Email**: 개발 편의상 *Confirm email* 끄기 (선택)
3. **Authentication → URL Configuration**: Site URL과 Redirect URLs에 `http://localhost:3000/auth/callback`, 배포 URL 추가
4. **Google 로그인**: Google Cloud Console → *APIs & Services → Credentials* 에서 OAuth 2.0 클라이언트(웹) 생성 →
   *Authorized redirect URI* 에 `https://<프로젝트>.supabase.co/auth/v1/callback` 추가 →
   client ID/secret 을 Supabase **Authentication → Providers → Google** 에 붙여넣고 활성화
5. **관리자 계정**: `supabase/schema.sql` 맨 아래 주석 두 줄 중 하나를 본인 이메일로 바꿔 실행하세요.
   - `admin_emails` 에 이메일을 넣어두면 **그 이메일로 가입할 때 자동으로 관리자**가 돼요.
   - 이미 가입했다면 두 번째 스니펫으로 바로 승격할 수 있어요.
   관리자가 되면 헤더에 *관리자* 메뉴가 생기고 `/admin` 에서 팝업 스토어를 등록·수정할 수 있어요.

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
│       ├── popup/            # 팝업 스토어 목록 + 상세 [id]
│       ├── admin/            # 관리자 (팝업 CRUD, AI 검색) — admins 테이블 확인 후 접근
│       ├── settings/         # 닉네임 수정
│       ├── glossary/         # 용어 사전
│       └── whisky/           # 위스키 탐색 목록 + 상세 [id]
│   ├── share/                # 공개 공유 카드 (URL 파라미터 기반)
│   └── api/chat, api/og      # 채팅 스트림, OG 이미지
├── data/
│   ├── whiskies.ts           # 위스키 사전 (정적, 312병)
│   ├── distilleries.ts       # 증류소 메타 (108곳)
│   ├── glossary.ts           # 용어 사전
│   ├── popups.ts             # 팝업 스토어 타입 + 예시 시드
│   └── quiz.ts               # 진단 질문 + 축 델타
├── components/ui/            # shadcn
├── lib/
│   ├── ai/                   # provider.ts (Claude/OpenAI/Gemini 어댑터), web-research.ts
│   │                         # (검색 그라운딩) + 기능별 프롬프트
│   ├── auth/admin.ts         # 관리자 확인
│   ├── popup/                # 팝업 상태 계산, 링크 만들기, DB↔시드 로더
│   ├── supabase/             # browser / server / proxy 클라이언트
│   └── whisky/               # 도메인 타입, 추천 점수 계산, 포맷 헬퍼
└── proxy.ts                  # 세션 갱신 + 보호 라우트 리다이렉트
supabase/schema.sql           # DB 스키마 (profiles, tasting_notes, recommendations,
                              #            admins/admin_emails, popup_stores)
```

## 로드맵

- [x] P0 · 프로젝트 세팅, 인증, 배포 파이프라인
- [x] P0 · 위스키 사전 데이터 (312병, `src/data/whiskies.ts`)
- [x] P0 · 취향 진단 → AI 추천 (`/quiz` → `/recommend`) + 위스키 탐색 (`/whisky`)
- [x] P1 · 병 스캔 (Claude 비전, `/scan`)
- [x] P1 · 테이스팅 노트 → 취향 갱신 → 재추천 (`/journal`)
- [x] P1 · AI 소믈리에 채팅 (사전 검색 tool use, `/chat`)
- [x] P2 · 지구본 증류소 지도 (`/map`), 용어 사전·팝오버 (`/glossary`), 두 병 비교 (`/compare`), 공유 카드 (`/share`, OG 이미지)
- [x] P2 · 팝업 스토어 (`/popup`) + 관리자 페이지 (`/admin`), Google 로그인
- [x] P2 · AI 프로바이더 교체 (Claude / ChatGPT / Gemini)
- [x] P2 · 닉네임 지정, AI 웹 검색으로 팝업 초안 만들기
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
