/**
 * AI 기능들을 **실제 코드 경로 그대로** 통과시켜 보는 점검 스크립트.
 *
 * 점검 내용 자체는 `src/lib/ai/self-check.ts` 에 있어요 (관리자 화면
 * `/admin/ai` 도 같은 걸 써요). 여기서는 터미널에서 돌리고 결과를 찍어요.
 *
 * 진짜 키가 없어도 `scripts/mock-gemini.mjs` 를 띄우고 GEMINI_BASE_URL 을 거기로
 * 돌리면, 요청 모양 · 스키마 변환 · SSE 파싱 · 툴 루프가 다 돌아가는지 확인돼요.
 *
 *   npm run ai:check          # 가짜 서버로 (키 없이)
 *   npm run ai:check:live     # 진짜 키로 (.env.local 의 키를 씁니다)
 */

import { runAiSelfCheck } from "@/lib/ai/self-check";

const report = await runAiSelfCheck();

if (!report.provider) {
  console.log("프로바이더가 없어요 — ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY 중 하나를 설정해주세요.");
  process.exit(1);
}

console.log(
  `프로바이더: ${report.provider.label} (${report.provider.id}) · 모델 ${report.provider.model}` +
    (report.endpoint ? `\n엔드포인트: ${report.endpoint} (가짜 서버)` : ""),
);
console.log("");

for (const r of report.results) {
  console.log(`  ${r.ok ? "✅" : "❌"} ${r.name} — ${r.detail} (${r.ms}ms)`);
  if (r.hint) console.log(`     ↳ ${r.hint}`);
}

const failures = report.results.filter((r) => !r.ok).length;
console.log(`\n${failures === 0 ? `전부 통과했어요 ✨ (${report.ms}ms)` : `${failures}개 실패`}`);
process.exit(failures === 0 ? 0 : 1);
