"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { probeGemini, type ProbeReport } from "@/lib/ai/probe";
import { CHECKS, runAiSelfCheck, type CheckId, type CheckResult } from "@/lib/ai/self-check";

/**
 * 점검 하나를 돌려요.
 *
 * 한 번에 다 돌리지 않고 하나씩 부르는 이유: 진짜 키로 부르면 검사 하나가
 * 몇십 초씩 걸려서 서버 함수 실행 시간 제한에 걸릴 수 있어요. 하나씩 부르면
 * 화면에도 끝나는 대로 하나씩 표시돼서 기다리는 느낌이 덜해요.
 */
export async function runCheck(id: CheckId): Promise<CheckResult | { error: string }> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 쓸 수 있어요." };

  const meta = CHECKS.find((c) => c.id === id);
  if (!meta) return { error: `모르는 점검이에요 (${id})` };

  const report = await runAiSelfCheck([id]);
  if (!report.provider) {
    return { error: "AI 키가 없어요. Vercel 환경변수에 키를 넣고 다시 배포해주세요." };
  }
  return report.results[0];
}

/**
 * "한도인가, 기능이 안 되는 건가" 를 가리는 진단.
 *
 * 자기점검은 기능을 부르니까 실패하면 "폴백이에요" 로만 보여요. 이건 같은 키로
 * 최소 호출을 **웹 검색 없이 / 붙여서** 두 번 날려 원시 상태를 보여줘요.
 * 자세한 이유는 `src/lib/ai/probe.ts` 주석에 있어요.
 */
export async function runProbe(): Promise<ProbeReport | { error: string }> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 쓸 수 있어요." };
  return probeGemini();
}
