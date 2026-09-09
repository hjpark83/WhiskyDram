import { z } from "zod";
import { WHISKIES } from "@/data/whiskies";
import { DISTILLERY_META } from "@/data/distilleries";
import { activeProvider, generateJson, toAiError } from "@/lib/ai/provider";
import { researchWeb, type ResearchSource } from "@/lib/ai/web-research";

/**
 * AI 가 웹에서 위스키 브랜드 팝업을 찾아 **초안**을 만들어요.
 *
 * 중요한 전제: 여기서 나온 건 사실 확인이 끝난 정보가 아니에요.
 * 기간·주소·가격이 틀리면 사용자가 헛걸음을 하니까, 초안은 항상 비공개로 저장되고
 * 관리자가 출처를 눌러 확인한 뒤에만 공개돼요 (`/admin/popups`).
 */

export interface PopupDraft {
  brand: string;
  brandEn: string;
  title: string;
  summary: string;
  description: string;
  highlights: string[];
  venue: string;
  address: string;
  city: string;
  startDate: string;
  endDate: string;
  hours: string;
  entry: string;
  reservation: "catchtable" | "naver" | "instagram" | "walkin";
  /** 이 항목의 근거가 된 주소 */
  sources: string[];
  /** 얼마나 믿을 만한지 — low 면 관리자가 반드시 확인해야 해요 */
  confidence: "high" | "medium" | "low";
  /** 무엇을 확인해야 하는지 한 줄 */
  verifyNote: string;
  /** 사전에서 이어붙인 관련 위스키 (AI 가 정하지 않아요) */
  whiskyIds: string[];
}

export interface ResearchReport {
  drafts: PopupDraft[];
  sources: ResearchSource[];
  provider: string;
  model: string;
  /** 검색은 됐는데 건진 게 없을 때 이유 */
  note: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 브랜드 이름으로 사전의 위스키를 이어줘요 (AI 가 id 를 지어내지 않게 코드에서 매칭) */
export function whiskyIdsForBrand(brand: string, limit = 4): string[] {
  const q = brand.trim().toLowerCase();
  if (!q) return [];
  return WHISKIES.filter(
    (w) =>
      w.nameKo.toLowerCase().includes(q) ||
      w.name.toLowerCase().includes(q) ||
      w.distillery.toLowerCase().includes(q) ||
      (DISTILLERY_META[w.distillery]?.nameKo ?? "").toLowerCase().includes(q),
  )
    .sort((a, b) => a.priceKrw[0] - b.priceKrw[0])
    .slice(0, limit)
    .map((w) => w.id);
}

/** 관리자 화면에서 기본값으로 채워줄 브랜드 (사전에 병이 많은 순) */
export function suggestedBrands(count = 8): string[] {
  const byBrand = new Map<string, number>();
  for (const w of WHISKIES) {
    const ko = DISTILLERY_META[w.distillery]?.nameKo;
    if (!ko) continue;
    byBrand.set(ko, (byBrand.get(ko) ?? 0) + 1);
  }
  return [...byBrand.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([name]) => name);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function researchPrompt(brands: string[], region: string): string {
  return [
    `오늘은 ${today()} 입니다.`,
    `한국(${region})에서 진행 중이거나 곧 열리는 **위스키 브랜드 팝업 스토어 / 시음 행사**를 웹에서 찾아주세요.`,
    brands.length > 0 ? `관심 브랜드: ${brands.join(", ")}. 다른 위스키 브랜드가 있으면 함께 알려주세요.` : "",
    "",
    "검색할 때 캐치테이블, 네이버 블로그·플레이스, 브랜드 공식 인스타그램, 팝업 정보 매체를 살펴보세요.",
    "",
    "찾은 행사마다 아래를 있는 그대로 적어주세요. 확인되지 않은 항목은 지어내지 말고 '확인 안 됨'이라고 쓰세요.",
    "- 브랜드 / 행사 이름",
    "- 기간 (시작일, 종료일)",
    "- 장소 이름과 주소 (구 단위까지라도)",
    "- 운영 시간, 입장료, 예약 방법(캐치테이블/네이버/인스타/현장)",
    "- 어떤 프로그램인지 (시음 구성, 체험)",
    "- 각 정보를 어디서 봤는지 URL",
    "",
    "이미 끝난 행사는 종료됐다고 표시해주세요. 근거 없는 추측은 쓰지 마세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

const EXTRACT_SYSTEM = `당신은 조사 메모를 구조화된 데이터로 옮기는 사람이에요.

원칙:
- 메모에 적힌 사실만 옮겨요. 메모에 없는 날짜·주소·가격을 절대 만들어내지 마세요.
- 확인되지 않은 항목은 빈 문자열로 두세요. 그럴듯하게 채우는 것보다 비어 있는 게 나아요.
- startDate / endDate 는 YYYY-MM-DD. 메모에 기간이 없으면 둘 다 빈 문자열로 두고 confidence 를 low 로.
- confidence: high = 기간·장소·출처가 모두 분명함, medium = 일부만, low = 불확실하거나 출처가 약함.
- verifyNote 에는 관리자가 확인해야 할 것을 한 문장으로 적어요. 예: "종료일이 기사마다 달라요."
- 설명(description)과 요약(summary)은 한국어 ~해요체로, 위스키 용어는 쉬운 말로 풀어써요.
- 위스키 행사가 아니면 목록에 넣지 마세요.`;

export async function researchPopups(input: {
  brands: string[];
  region?: string;
}): Promise<ResearchReport> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error("AI 키가 설정되어 있지 않아요. Vercel 환경변수에 키를 넣어주세요.");
  }

  const region = input.region?.trim() || "전국";
  const research = await researchWeb(researchPrompt(input.brands, region));

  if (!research.text.trim()) {
    return {
      drafts: [],
      sources: research.sources,
      provider: research.provider,
      model: research.model,
      note: "검색 결과에서 아무 내용도 받지 못했어요. 브랜드를 바꿔서 다시 시도해보세요.",
    };
  }

  const Schema = z.object({
    events: z
      .array(
        z.object({
          brand: z.string().describe("브랜드 한글 표기. 예: 발베니"),
          brandEn: z.string().describe("브랜드 영문. 모르면 빈 문자열."),
          title: z.string().describe("행사 이름."),
          summary: z.string().describe("한 줄 요약. 40자 내외."),
          description: z.string().describe("어떤 내용인지 2~4문장. 메모에 있는 것만."),
          highlights: z.array(z.string()).max(5).describe("가서 할 수 있는 것. 없으면 빈 배열."),
          venue: z.string().describe("장소 이름. 모르면 빈 문자열."),
          address: z.string().describe("주소. 모르면 빈 문자열."),
          city: z.string().describe("서울/부산 같은 도시. 모르면 빈 문자열."),
          startDate: z.string().describe("YYYY-MM-DD. 모르면 빈 문자열."),
          endDate: z.string().describe("YYYY-MM-DD. 모르면 빈 문자열."),
          hours: z.string().describe("운영 시간. 모르면 빈 문자열."),
          entry: z.string().describe("입장료·구성. 모르면 빈 문자열."),
          reservation: z.enum(["catchtable", "naver", "instagram", "walkin"]),
          sources: z.array(z.string()).max(5).describe("근거 URL. 메모에 나온 것만."),
          confidence: z.enum(["high", "medium", "low"]),
          verifyNote: z.string().describe("관리자가 확인할 것 한 문장."),
        }),
      )
      .max(10),
  });

  const { data } = await generateJson({
    system: EXTRACT_SYSTEM,
    user: [
      `오늘은 ${today()} 입니다.`,
      "",
      "## 조사 메모",
      research.text,
      "",
      "## 검색에서 나온 출처",
      research.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") || "(없음)",
      "",
      "위 메모에 실제로 적힌 행사만 구조화해주세요.",
    ].join("\n"),
    schema: Schema,
    schemaName: "popup_research",
    maxTokens: 8000,
    effort: "medium",
  });

  const drafts: PopupDraft[] = data.events.map((e) => ({
    ...e,
    // 기간 형식이 어긋나면 비워두고 관리자가 채우게 해요 (그럴듯한 날짜를 지어내지 않아요)
    startDate: ISO_DATE.test(e.startDate) ? e.startDate : "",
    endDate: ISO_DATE.test(e.endDate) ? e.endDate : "",
    sources: e.sources.filter((u) => /^https?:\/\//i.test(u)),
    whiskyIds: whiskyIdsForBrand(e.brand),
  }));

  return {
    drafts,
    sources: research.sources,
    provider: research.provider,
    model: research.model,
    note: drafts.length === 0 ? "조건에 맞는 팝업을 찾지 못했어요." : null,
  };
}

/** 화면에 띄울 오류 문구 */
export function researchErrorMessage(error: unknown): string {
  const err = toAiError(error);
  if (err.kind === "auth") return "AI 키 설정을 확인해주세요. 웹 검색은 키가 있어야 돼요.";
  if (err.kind === "rate_limit") return "요청이 많아요. 잠시 후 다시 시도해주세요.";
  return `검색에 실패했어요: ${err.message.slice(0, 200)}`;
}

// ---------------------------------------------------------------------------
// 저장해둔 팝업 다시 확인하기
// ---------------------------------------------------------------------------

/**
 * 이미 저장한 팝업 **한 건**을 웹에서 다시 확인해요.
 *
 * ## 왜 따로 만드나
 *
 * `researchPopups()` 는 "이 브랜드의 팝업을 찾아줘" 라 무엇이 나올지 몰라요.
 * 재확인은 반대예요 — **어떤 행사인지 이미 알고**, 우리가 적어둔 값이 아직
 * 맞는지만 봐요. 그래서 프롬프트에 지금 값을 넣고 "이게 맞나" 를 물어요.
 * 이렇게 물으면 같은 행사를 다시 찾아 헤매지 않고, 답도 비교하기 쉬워요.
 *
 * ## 설명·프로그램은 다시 안 물어봐요
 *
 * 기간·시간·장소·입장료·예약 방법만 봐요. 설명글은 표현이 매번 조금씩 달라져서
 * 매번 "바뀌었다" 로 잡히는데, 정작 사용자에게는 아무 차이가 없어요. 헛제안이
 * 쌓이면 관리자가 제안을 안 보게 돼요.
 */
export interface PopupCheck {
  /** 웹에서 이 행사를 찾았는지. false 면 아무 것도 제안하지 않아요 */
  found: boolean;
  /** 이미 끝난 행사로 보이는지 */
  ended: boolean;
  startDate: string;
  endDate: string;
  hours: string;
  entry: string;
  venue: string;
  address: string;
  reservation: "catchtable" | "naver" | "instagram" | "walkin" | "";
  sources: string[];
  confidence: "high" | "medium" | "low";
  note: string;
  provider: string;
  model: string;
}

/** 재확인에 넘길 지금 값 (PopupRecord 를 그대로 받지 않으려고 최소한만) */
export interface PopupSnapshot {
  brand: string;
  title: string;
  venue: string;
  city: string;
  address: string;
  startDate: string;
  endDate: string;
  hours: string;
  entry: string;
  reservation: string;
  sources: string[];
}

function recheckPrompt(p: PopupSnapshot): string {
  return [
    `오늘은 ${today()} 입니다.`,
    `아래 위스키 팝업 행사가 **지금도 그대로인지** 웹에서 확인해주세요.`,
    "",
    "## 우리가 갖고 있는 정보",
    `- 브랜드: ${p.brand}`,
    `- 행사: ${p.title}`,
    p.venue || p.city ? `- 장소: ${[p.city, p.venue].filter(Boolean).join(" ")}` : "",
    p.address ? `- 주소: ${p.address}` : "",
    p.startDate && p.endDate ? `- 기간: ${p.startDate} ~ ${p.endDate}` : "",
    p.hours ? `- 운영 시간: ${p.hours}` : "",
    p.entry ? `- 입장료: ${p.entry}` : "",
    p.sources.length > 0 ? `- 전에 본 출처: ${p.sources.join(", ")}` : "",
    "",
    "## 확인할 것",
    "- 기간이 바뀌었나요? (연장·단축·조기 종료)",
    "- 운영 시간, 입장료, 장소, 예약 방법이 바뀌었나요?",
    "- 이미 끝난 행사인가요?",
    "",
    "바뀐 게 없으면 '그대로' 라고 알려주세요. 확인이 안 되는 항목은 추측하지 말고",
    "'확인 안 됨' 이라고 쓰세요. 각 정보를 어디서 봤는지 URL 을 함께 적어주세요.",
    "이 행사를 웹에서 아예 못 찾았으면 '못 찾음' 이라고 분명히 써주세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

const RECHECK_SYSTEM = `당신은 조사 메모에서 행사 정보를 그대로 옮기는 사람이에요.

원칙:
- 메모에 적힌 사실만 옮겨요. 메모에 없는 날짜·주소·가격을 만들어내지 마세요.
- **확인되지 않은 항목은 빈 문자열로 두세요.** 이게 가장 중요해요. 빈 문자열은
  "모르겠다" 로 처리돼서 기존 값이 그대로 유지돼요. 반대로 추측해서 채우면
  맞는 정보가 틀린 정보로 덮여요.
- 메모가 "그대로" 라고 하면, 확인된 값을 그대로 옮겨 적어요 (빈 칸이 아니라).
- 행사를 못 찾았으면 found = false. 이때 다른 값은 모두 빈 문자열로.
- startDate / endDate 는 YYYY-MM-DD 형식만.
- note 는 관리자가 알아야 할 것 한 문장. 없으면 빈 문자열.`;

export async function recheckPopup(p: PopupSnapshot): Promise<PopupCheck> {
  const provider = activeProvider();
  if (!provider) throw new Error("AI 키가 설정되어 있지 않아요.");

  const research = await researchWeb(recheckPrompt(p));

  const Schema = z.object({
    found: z.boolean().describe("이 행사를 웹에서 찾았는지."),
    ended: z.boolean().describe("이미 끝난 행사로 보이는지."),
    startDate: z.string().describe("YYYY-MM-DD. 확인 안 되면 빈 문자열."),
    endDate: z.string().describe("YYYY-MM-DD. 확인 안 되면 빈 문자열."),
    hours: z.string().describe("운영 시간. 확인 안 되면 빈 문자열."),
    entry: z.string().describe("입장료·구성. 확인 안 되면 빈 문자열."),
    venue: z.string().describe("장소 이름. 확인 안 되면 빈 문자열."),
    address: z.string().describe("주소. 확인 안 되면 빈 문자열."),
    reservation: z
      .enum(["catchtable", "naver", "instagram", "walkin", ""])
      .describe("예약 방법. 확인 안 되면 빈 문자열."),
    sources: z.array(z.string()).max(5).describe("근거 URL. 메모에 나온 것만."),
    confidence: z.enum(["high", "medium", "low"]),
    note: z.string().describe("관리자가 알아야 할 것 한 문장. 없으면 빈 문자열."),
  });

  const { data } = await generateJson({
    system: RECHECK_SYSTEM,
    user: [
      `오늘은 ${today()} 입니다.`,
      "",
      "## 확인한 행사",
      `${p.brand} — ${p.title}`,
      "",
      "## 조사 메모",
      research.text || "(내용 없음)",
      "",
      "## 검색에서 나온 출처",
      research.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") || "(없음)",
    ].join("\n"),
    schema: Schema,
    schemaName: "popup_recheck",
    maxTokens: 2000,
    effort: "low",
  });

  return {
    ...data,
    // 형식이 어긋난 날짜는 "모르겠다" 로 (그럴듯한 날짜를 그대로 받지 않아요)
    startDate: ISO_DATE.test(data.startDate) ? data.startDate : "",
    endDate: ISO_DATE.test(data.endDate) ? data.endDate : "",
    sources: data.sources.filter((u) => /^https?:\/\//i.test(u)),
    provider: research.provider,
    model: research.model,
  };
}
