/**
 * AI 기능 4개 + 팝업 검색을 **실제 코드 경로 그대로** 통과시켜 보는 점검 스크립트.
 *
 * 진짜 키가 없어도 `scripts/mock-gemini.mjs` 를 띄우고 GEMINI_BASE_URL 을 거기로
 * 돌리면, 요청 모양 · 스키마 변환 · SSE 파싱 · 툴 루프가 다 돌아가는지 확인돼요.
 * 진짜 키가 있으면 GEMINI_BASE_URL 없이 그대로 돌리면 실제 호출을 해요.
 *
 *   npm run ai:check          # 가짜 서버로 (키 없이)
 *   npm run ai:check:live     # 진짜 키로 (.env.local 의 키를 씁니다)
 */

import { activeProvider } from "@/lib/ai/provider";
import { generateQuizRecommendation } from "@/lib/ai/recommend";
import { generateJournalRecommendation } from "@/lib/ai/journal";
import { scanBottle } from "@/lib/ai/scan";
import { runChat } from "@/lib/ai/chat";
import { researchPopups } from "@/lib/ai/popup-research";
import { WHISKIES } from "@/data/whiskies";
import { rankWhiskies } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";

const PROFILE: TasteProfile = { ...EMPTY_TASTE_PROFILE, sweet: 2, fruit: 1, peat: -1, body: 1 };

// 1x1 투명 PNG (비전 경로가 이미지를 제대로 실어 보내는지만 봐요)
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let failures = 0;

function pass(name: string, detail: string) {
  console.log(`  ✅ ${name} — ${detail}`);
}

function fail(name: string, detail: string) {
  failures += 1;
  console.log(`  ❌ ${name} — ${detail}`);
}

async function checkQuiz() {
  const candidates = rankWhiskies(PROFILE, {}, 8);
  const payload = await generateQuizRecommendation({
    profile: PROFILE,
    answers: { experience: "beginner", budget: "mid" },
    candidates,
  });
  if (payload.generatedBy !== "ai") {
    return fail("취향 진단", `AI 응답이 아니라 폴백으로 떨어졌어요 (${payload.generatedBy})`);
  }
  if (payload.picks.length !== 3) return fail("취향 진단", `추천이 3병이 아니에요 (${payload.picks.length})`);
  const known = payload.picks.every((p) => WHISKIES.some((w) => w.id === p.whiskyId));
  if (!known) return fail("취향 진단", "사전에 없는 위스키 id 가 왔어요");
  pass("취향 진단", `${payload.provider} · ${payload.picks.length}병 · "${payload.tasteTitle}"`);
}

async function checkJournal() {
  const whisky = WHISKIES.find((w) => w.id === "glenfiddich-12") ?? WHISKIES[0];
  const result = await generateJournalRecommendation({
    whisky,
    rating: 4,
    review: "달고 부드러워서 좋았어요. 연기 향은 별로였어요.",
    profileBefore: PROFILE,
    history: [],
    candidates: rankWhiskies(PROFILE, { excludeIds: [whisky.id] }, 8),
  });
  if (result.payload.generatedBy !== "ai") {
    return fail("후기 분석", `폴백으로 떨어졌어요 (${result.payload.generatedBy})`);
  }
  if (!result.payload.basedOn) return fail("후기 분석", "basedOn 이 비었어요");
  const axes = Object.keys(result.profileAfter).length;
  pass("후기 분석", `${result.payload.provider} · 취향 축 ${axes}개 갱신 · "${result.payload.basedOn.summary}"`);
}

async function checkScan() {
  const result = await scanBottle({
    imageBase64: TINY_PNG,
    mediaType: "image/png",
    profile: PROFILE,
  });
  if (result.generatedBy !== "ai") return fail("병 스캔", `폴백으로 떨어졌어요 (${result.generatedBy})`);
  pass("병 스캔", `${result.provider} · 확신도 ${result.confidence} · id=${result.whiskyId ?? "unknown"}`);
}

async function checkChat() {
  const events: string[] = [];
  let text = "";
  let toolCalls = 0;
  for await (const event of runChat([{ role: "user", content: "삼겹살에 어울리는 위스키 알려줘" }], {
    profile: PROFILE,
    recentNotes: [],
  })) {
    events.push(event.type);
    if (event.type === "text") text += event.text;
    if (event.type === "tool") toolCalls += 1;
    if (event.type === "error") return fail("소믈리에 채팅", event.message);
  }
  if (!events.includes("done")) return fail("소믈리에 채팅", "done 이벤트가 안 왔어요");
  if (toolCalls === 0) return fail("소믈리에 채팅", "도구를 한 번도 안 불렀어요 (툴 루프 확인 필요)");
  if (!text.trim()) return fail("소믈리에 채팅", "글자가 하나도 안 왔어요 (SSE 파싱 확인 필요)");
  pass("소믈리에 채팅", `도구 ${toolCalls}회 · 글자 ${text.length}자 · "${text.slice(0, 24)}…"`);
}

async function checkPopupResearch() {
  const report = await researchPopups({ brands: ["발베니"], region: "서울" });
  if (report.drafts.length === 0) {
    return fail("팝업 검색", report.note ?? "초안이 하나도 안 나왔어요");
  }
  const draft = report.drafts[0];
  pass(
    "팝업 검색",
    `${report.provider} · 초안 ${report.drafts.length}개 · 출처 ${report.sources.length}개 · "${draft.title}"`,
  );
}

const CHECKS: [string, () => Promise<void>][] = [
  ["취향 진단", checkQuiz],
  ["후기 분석", checkJournal],
  ["병 스캔", checkScan],
  ["소믈리에 채팅", checkChat],
  ["팝업 검색", checkPopupResearch],
];

const provider = activeProvider();
console.log(
  provider
    ? `프로바이더: ${provider.label} (${provider.id}) · 모델 ${provider.model}` +
        (process.env.GEMINI_BASE_URL ? `\n엔드포인트: ${process.env.GEMINI_BASE_URL} (가짜 서버)` : "")
    : "프로바이더가 없어요 — 키를 설정해주세요.",
);
if (!provider) process.exit(1);

console.log("");
for (const [name, run] of CHECKS) {
  try {
    await run();
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
}

console.log(`\n${failures === 0 ? "전부 통과했어요 ✨" : `${failures}개 실패`}`);
process.exit(failures === 0 ? 0 : 1);
