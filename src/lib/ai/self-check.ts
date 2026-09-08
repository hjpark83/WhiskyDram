/**
 * AI 자기점검.
 *
 * 이 앱의 AI 기능들을 **실제 코드 경로 그대로** 한 번씩 호출해 보고, 결과가
 * 진짜 AI 응답인지(폴백이 아닌지) 확인해요. 키를 넣고 배포한 뒤 정말 동작하는지
 * 보려면 관리자 화면(`/admin/ai`)에서 누르면 되고, 키가 없을 때는 가짜 Gemini
 * 서버로 같은 점검을 돌려요 (`npm run ai:check`).
 *
 * 프로바이더마다 걸리는 곳이 달라요 (Gemini 는 스키마 변환, Claude·ChatGPT 는
 * 툴 스트리밍). 그래서 "키가 있다" 만으로는 부족하고 이렇게 다 불러봐야 해요.
 */

import { FEATURES } from "@/data/features";
import { GENDER_LABELS_KO, type Persona } from "@/data/persona";
import { WHISKIES } from "@/data/whiskies";
import { personaText } from "@/lib/ai/persona";
import { runChat } from "@/lib/ai/chat";
import { generateJournalRecommendation } from "@/lib/ai/journal";
import { researchPopups } from "@/lib/ai/popup-research";
import { judgePrice } from "@/lib/ai/price";
import { activeProvider, type ProviderInfo } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/provider-shared";
import { generateQuizRecommendation } from "@/lib/ai/recommend";
import { scanBottle } from "@/lib/ai/scan";
import { per700, summarize } from "@/lib/price/stats";
import type { PriceReport } from "@/lib/price/types";
import { rankWhiskies } from "@/lib/whisky/recommend";
import { analyzeTaste } from "@/lib/ai/taste";
import { QUIZ_QUESTIONS } from "@/data/quiz";
import { EMPTY_TASTE_PROFILE, TASTE_AXES, type TasteProfile } from "@/lib/whisky/types";

/** 점검용 가짜 취향 (단맛·과일 쪽으로 살짝 기울인 초보) */
const PROFILE: TasteProfile = { ...EMPTY_TASTE_PROFILE, sweet: 2, fruit: 1, peat: -1, body: 1 };

/** 1x1 투명 PNG. 비전 경로가 이미지를 제대로 실어 보내는지만 봐요. */
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export type CheckId =
  | "persona"
  | "taste"
  | "quiz"
  | "journal"
  | "scan"
  | "chat"
  | "price"
  | "popup";

export interface CheckMeta {
  id: CheckId;
  name: string;
  /** 이 점검이 무엇을 확인하는지 */
  what: string;
}

const ALL_CHECKS: CheckMeta[] = [
  { id: "persona", name: "개인정보 취급", what: "성별이 프롬프트에 안 들어가는지 (AI 호출 없음)" },
  {
    id: "taste",
    name: "AI 취향 분석",
    what: "답변을 읽고 취향 벡터를 직접 만드는지 · 싫다는 답을 뒤집지 않는지",
  },
  { id: "quiz", name: "취향 진단 추천", what: "구조화 JSON · 정해진 개수(3병) · 사전에 있는 id" },
  { id: "journal", name: "후기 분석", what: "구조화 JSON · 취향 축 갱신" },
  { id: "scan", name: "병 사진 스캔", what: "이미지 입력(비전) · 구조화 JSON" },
  { id: "chat", name: "소믈리에 채팅", what: "스트리밍(SSE) · 도구 호출 루프" },
  { id: "price", name: "시세 판정", what: "구조화 JSON · 제보 숫자를 읽고 판정" },
  { id: "popup", name: "팝업 웹 검색", what: "검색 그라운딩 + 초안 추출 (2번 호출, 조금 느려요)" },
];

/** 꺼둔 기능은 점검도 안 해요 (src/data/features.ts) */
export const CHECKS: CheckMeta[] = ALL_CHECKS.filter(
  (c) => c.id !== "popup" || FEATURES.popup,
);

export interface CheckResult extends CheckMeta {
  ok: boolean;
  /** 무엇이 왔는지 한 줄 */
  detail: string;
  /** 실패했을 때 무엇을 확인해야 하는지 */
  hint: string | null;
  ms: number;
}

export interface SelfCheckReport {
  provider: ProviderInfo | null;
  /** 가짜 서버로 돌렸으면 그 주소 */
  endpoint: string | null;
  results: CheckResult[];
  ms: number;
}

/** 검사 하나의 결과 (성공이면 detail 만, 실패면 이유와 힌트) */
type Outcome = { ok: true; detail: string } | { ok: false; detail: string; hint?: string };

function ok(detail: string): Outcome {
  return { ok: true, detail };
}

function no(detail: string, hint?: string): Outcome {
  return { ok: false, detail, hint };
}

/** "폴백으로 떨어졌다" 는 곧 호출이 실패했다는 뜻이라, 서버 로그를 보라고 안내해요. */
const FALLBACK_HINT =
  "키는 있는데 호출이 실패해서 규칙 기반 결과로 넘어갔어요. 서버 로그(Vercel → Logs)에 [ai] 로 시작하는 줄을 보면 이유가 나와요.";

// ── 개별 점검 ───────────────────────────────────────────────────────────────

/**
 * 약속한 대로 성별이 프롬프트에 안 들어가는지 확인해요.
 *
 * AI 를 부르지 않아서 공짜고 즉시 끝나요. 화면에서 "성별은 추천에 쓰지
 * 않아요" 라고 말해놨으니, 그 약속이 코드에서 지켜지는지 기계가 지켜봐야 해요.
 */
async function checkPersona(): Promise<Outcome> {
  const full: Persona = {
    ageBand: "30s",
    gender: "female",
    scenes: ["alone", "meal"],
    likes: "바닐라 향",
    avoids: "소독약 냄새",
  };
  const text = personaText(full) ?? "";
  if (!text) return no("내 정보가 프롬프트에 아예 안 들어갔어요", "personaText() 를 확인해주세요.");

  // 성별 값·라벨 어느 쪽도 새면 안 돼요
  const leaked = ["female", "male", ...Object.values(GENDER_LABELS_KO)].filter((word) =>
    text.includes(word),
  );
  if (leaked.length > 0) {
    return no(
      `성별이 프롬프트에 들어갔어요 (${leaked.join(", ")})`,
      "personaText() 에서 성별을 빼야 해요 — 화면에서 안 쓴다고 약속했어요.",
    );
  }
  if (!text.includes(full.avoids)) {
    return no("피하고 싶은 것이 프롬프트에 안 들어갔어요", "그건 꼭 지켜야 하는 조건이에요.");
  }
  if (!text.includes("단정하지 마세요")) {
    return no("나이대 단정 금지 문구가 빠졌어요", "나이대만 넣고 경고를 빼면 고정관념이 생겨요.");
  }
  return ok(`상황·좋아함·피함은 들어가고 성별은 빠졌어요 (${text.split("\n").length - 1}줄)`);
}

/**
 * AI 취향 분석.
 *
 * 제일 중요한 건 **싫다고 답한 걸 AI 가 뒤집지 못하는지**예요. "연기 냄새는
 * 싫어요" 를 고른 답변을 넣고, 결과가 그래도 음수인지 봐요. 여기가 뚫리면
 * 규칙 쪽에서 고쳐놓은 걸 AI 가 되돌려버려요.
 */
async function checkTaste(): Promise<Outcome> {
  const answers = Object.fromEntries(
    QUIZ_QUESTIONS.map((q) => [q.id, q.options[0].id]),
  ) as Record<string, string>;
  answers.smoke = "hate"; // 연기 냄새는 싫어요

  const result = await analyzeTaste(answers, {
    ageBand: "30s",
    gender: null,
    scenes: ["alone"],
    likes: "바닐라, 꿀 같은 단 향",
    avoids: "소독약 냄새",
  });

  if (result.generatedBy !== "ai") return no("AI 응답이 아니라 폴백이에요", FALLBACK_HINT);
  if (!result.summary.trim()) return no("분석 요약이 비었어요", "summary 필드를 확인해주세요.");

  if (result.profile.peat > -1) {
    return no(
      `"연기 냄새는 싫어요" 라고 답했는데 피트가 ${result.profile.peat} 로 나왔어요`,
      "직접 물어본 답(decisive)이 AI 결과에 적용되는지 analyzeTaste() 를 확인해주세요.",
    );
  }
  const axes = TASTE_AXES.map((a) => `${a} ${result.profile[a]}`).join(", ");
  return ok(`피트 ${result.profile.peat} 로 거부가 유지됐어요 (${axes})`);
}

async function checkQuiz(): Promise<Outcome> {
  const payload = await generateQuizRecommendation({
    profile: PROFILE,
    answers: { experience: "beginner", budget: "mid" },
    candidates: rankWhiskies(PROFILE, {}, 8),
  });
  if (payload.generatedBy !== "ai") return no(`AI 응답이 아니라 폴백이에요`, FALLBACK_HINT);
  if (payload.picks.length !== 3) {
    return no(
      `추천이 3병이 아니라 ${payload.picks.length}병이에요`,
      "스키마의 개수 제약(minItems/maxItems)이 프로바이더로 제대로 전달되는지 확인해주세요.",
    );
  }
  const unknown = payload.picks.find((p) => !WHISKIES.some((w) => w.id === p.whiskyId));
  if (unknown) {
    return no(
      `사전에 없는 id 가 왔어요 (${unknown.whiskyId})`,
      "후보 목록을 enum 으로 넘기는데도 모델이 지어냈어요. 모델을 바꾸거나 프롬프트를 조여야 해요.",
    );
  }
  return ok(`${payload.picks.length}병 · "${payload.tasteTitle}"`);
}

async function checkJournal(): Promise<Outcome> {
  const whisky = WHISKIES.find((w) => w.id === "glenfiddich-12") ?? WHISKIES[0];
  const result = await generateJournalRecommendation({
    whisky,
    rating: 4,
    review: "달고 부드러워서 좋았어요. 연기 향은 별로였어요.",
    profileBefore: PROFILE,
    history: [],
    candidates: rankWhiskies(PROFILE, { excludeIds: [whisky.id] }, 8),
  });
  if (result.payload.generatedBy !== "ai") return no("AI 응답이 아니라 폴백이에요", FALLBACK_HINT);
  if (!result.payload.basedOn) {
    return no("취향 분석(basedOn)이 비었어요", "후기에서 취향 축 변화를 못 뽑았어요. 프롬프트를 확인해주세요.");
  }
  const moved = Object.entries(result.profileAfter).filter(
    ([axis, v]) => v !== PROFILE[axis as keyof TasteProfile],
  );
  return ok(`"${result.payload.basedOn.summary}" · 취향 축 ${moved.length}개 움직임`);
}

async function checkScan(): Promise<Outcome> {
  const result = await scanBottle({ imageBase64: TINY_PNG, mediaType: "image/png", profile: PROFILE });
  if (result.generatedBy !== "ai") {
    return no(
      "AI 응답이 아니라 폴백이에요",
      `${FALLBACK_HINT} 비전(이미지 입력)을 지원하지 않는 모델이면 여기서만 실패해요.`,
    );
  }
  // 좌표 박스가 오면 화면에 그릴 수 있는 값인지 봐요 (뒤집히거나 범위를 벗어나면 못 그려요)
  const badBox = result.regions.find((r) => {
    const [ymin, xmin, ymax, xmax] = r.box;
    return (
      [ymin, xmin, ymax, xmax].some((v) => v < 0 || v > 1000) || ymax <= ymin || xmax <= xmin
    );
  });
  if (badBox) {
    return no(
      `좌표 박스가 이상해요 (${badBox.box.join(", ")})`,
      "scanBottle 이 거르지 못한 박스예요. 그대로 그리면 엉뚱한 자리에 상자가 떠요.",
    );
  }
  // 1x1 빈 이미지니까 못 알아보는 게 정상이에요. 호출이 됐는지만 봐요.
  return ok(
    `확신도 ${result.confidence} · 판정 ${result.whiskyId ?? "unknown"} · 읽은 자리 ${result.regions.length}곳 (빈 이미지라 정상이에요)`,
  );
}

async function checkChat(): Promise<Outcome> {
  let text = "";
  let tools = 0;
  let done = false;
  for await (const event of runChat([{ role: "user", content: "삼겹살에 어울리는 위스키 알려줘" }], {
    profile: PROFILE,
    recentNotes: [],
  })) {
    if (event.type === "text") text += event.text;
    if (event.type === "tool") tools += 1;
    if (event.type === "done") done = true;
    if (event.type === "error") return no(event.message, "채팅은 스트리밍이라 프록시·타임아웃 영향도 받아요.");
  }
  if (!done) return no("done 이벤트가 안 왔어요", "스트림이 중간에 끊겼어요. 함수 실행 시간 제한을 확인해주세요.");
  if (!text.trim()) {
    return no("글자가 하나도 안 왔어요", "SSE 조립이 안 되고 있어요. 프로바이더의 스트리밍 응답 형식을 확인해주세요.");
  }
  if (tools === 0) {
    return no(
      "위스키 찾기 도구를 한 번도 안 불렀어요",
      "글자는 오니까 스트리밍은 되는데 툴 루프가 안 돌았어요. 추천 답변이 사전 대신 모델 기억에서 나올 수 있어요.",
    );
  }
  return ok(`도구 ${tools}회 · ${text.length}자 · "${text.slice(0, 30)}…"`);
}

async function checkPrice(): Promise<Outcome> {
  const whisky = WHISKIES.find((w) => w.id === "glenfiddich-12") ?? WHISKIES[0];
  // 점검용 가짜 제보 3건 — DB 를 건드리지 않아요
  const seen = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const reports: PriceReport[] = [
    { id: "1", userId: "u", whiskyId: whisky.id, store: "traders", storeNote: "", priceKrw: whisky.priceKrw[0], volumeMl: 700, seenOn: seen, note: "" },
    { id: "2", userId: "u", whiskyId: whisky.id, store: "costco", storeNote: "", priceKrw: Math.round(whisky.priceKrw[0] * 1.3), volumeMl: 1000, seenOn: seen, note: "" },
    { id: "3", userId: "u", whiskyId: whisky.id, store: "emart", storeNote: "", priceKrw: whisky.priceKrw[1], volumeMl: 700, seenOn: seen, note: "" },
  ];
  const summary = summarize(whisky.id, reports);
  if (!summary) return no("시세 계산이 비었어요", "summarize() 가 제보를 못 읽었어요.");
  // 1L 병이 700ml 로 환산되는지도 같이 봐요 (환산이 틀리면 시세가 다 어긋나요)
  if (per700(reports[1]) >= reports[1].priceKrw) {
    return no("1L 제보의 700ml 환산이 틀렸어요", "per700() 을 확인해주세요.");
  }

  const result = await judgePrice({
    whisky,
    summary,
    profile: PROFILE,
    candidates: rankWhiskies(PROFILE, { excludeIds: [whisky.id] }, 6),
  });
  if (result.generatedBy !== "ai") return no("AI 응답이 아니라 폴백이에요", FALLBACK_HINT);
  const unknown = result.alternatives.find((a) => !WHISKIES.some((w) => w.id === a.whiskyId));
  if (unknown) return no(`사전에 없는 id 가 왔어요 (${unknown.whiskyId})`, "대안 후보를 코드에서 걸러야 해요.");
  return ok(`${STANCE_LABELS[result.stance]} · "${result.headline}" · 대안 ${result.alternatives.length}개`);
}

const STANCE_LABELS: Record<string, string> = { good: "싸다", fair: "보통", high: "비싸다" };

async function checkPopup(): Promise<Outcome> {
  const report = await researchPopups({ brands: ["발베니"], region: "서울" });
  if (report.drafts.length === 0) {
    return no(
      report.note ?? "초안이 하나도 안 나왔어요",
      "검색은 됐는데 건진 게 없을 수도 있어요 (실제로 진행 중인 팝업이 없으면 정상이에요). 출처 개수가 0이면 검색 그라운딩 자체가 안 붙은 거예요.",
    );
  }
  return ok(`초안 ${report.drafts.length}개 · 출처 ${report.sources.length}개 · "${report.drafts[0].title}"`);
}

const RUNNERS: Record<CheckId, () => Promise<Outcome>> = {
  persona: checkPersona,
  taste: checkTaste,
  quiz: checkQuiz,
  journal: checkJournal,
  scan: checkScan,
  chat: checkChat,
  price: checkPrice,
  popup: checkPopup,
};

/** 오류를 사용자가 무엇을 고쳐야 하는지로 번역해요. */
function hintForError(error: unknown): string {
  if (error instanceof AiError) {
    if (error.kind === "auth") {
      return "키가 거절당했어요. Vercel 환경변수의 키 값과 (Gemini 면) GEMINI_MODEL 이름을 확인해주세요.";
    }
    if (error.kind === "rate_limit") return "요청 한도에 걸렸어요. 잠시 뒤 다시 눌러주세요.";
    if (error.kind === "refusal") return "모델이 응답을 거부했어요. 프롬프트를 확인해주세요.";
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(message)) {
    return "네트워크에서 프로바이더에 못 닿았어요. GEMINI_BASE_URL 을 잘못 남겨두지 않았는지 확인해주세요.";
  }
  return "위 메시지를 그대로 검색해보거나 서버 로그를 확인해주세요.";
}

/**
 * 점검 사이에 두는 간격. 가짜 서버로 돌릴 때는 기다릴 이유가 없어요.
 * (`AI_CHECK_GAP_MS` 로 조절할 수 있어요.)
 */
const GAP_MS = Number(process.env.AI_CHECK_GAP_MS ?? (process.env.GEMINI_BASE_URL ? 0 : 4000));

/** 점검 하나를 돌려요. 예외가 새지 않아요. */
async function runOne(meta: CheckMeta): Promise<CheckResult> {
  const started = Date.now();
  try {
    const outcome = await RUNNERS[meta.id]();
    return {
      ...meta,
      ok: outcome.ok,
      detail: outcome.detail,
      hint: outcome.ok ? null : (outcome.hint ?? null),
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ...meta,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      hint: hintForError(error),
      ms: Date.now() - started,
    };
  }
}

/**
 * 전체 점검. 키가 없으면 `provider: null` 과 빈 결과를 돌려줘요.
 * 하나씩 순서대로 돌려요 — 한 번에 몰아치면 요청 한도에 걸려서
 * "키가 잘못됐다"고 착각하게 돼요.
 */
export async function runAiSelfCheck(only?: CheckId[]): Promise<SelfCheckReport> {
  const started = Date.now();
  const provider = activeProvider();
  const endpoint = process.env.GEMINI_BASE_URL?.trim() || null;
  if (!provider) return { provider: null, endpoint, results: [], ms: 0 };

  const wanted = only?.length ? CHECKS.filter((c) => only.includes(c.id)) : CHECKS;
  const results: CheckResult[] = [];
  for (const [i, meta] of wanted.entries()) {
    // Gemini 무료 등급은 분당 요청 수가 20건이라 연달아 부르면 429 가 나요.
    // 그러면 "키가 잘못됐다"고 착각하게 되니 사이를 좀 띄워요.
    if (i > 0) await new Promise((r) => setTimeout(r, GAP_MS));
    results.push(await runOne(meta));
  }
  return { provider, endpoint, results, ms: Date.now() - started };
}
