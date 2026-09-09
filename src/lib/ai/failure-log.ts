import { type AiErrorKind } from "@/lib/ai/provider-shared";
import { toAiError } from "@/lib/ai/provider";

/**
 * 마지막으로 실패한 AI 호출의 이유를 기억해둬요.
 *
 * ## 왜 필요한가
 *
 * AI 기능은 실패하면 **조용히 규칙 기반 폴백으로 넘어가요.** 데모가 멈추지
 * 않게 일부러 그렇게 만든 건데, 대신 화면에서는 "왜" 를 알 수가 없어요.
 * 자기점검(`/admin/ai`)이 할 수 있는 말이 "폴백이에요. Vercel 로그에서
 * [ai] 로 시작하는 줄을 보세요" 뿐이었어요 — 배포된 앱을 폰으로 확인하는
 * 중이면 그게 사실상 "모르겠어요" 예요.
 *
 * 실제로 이걸로 한참 헤맸어요: 자기점검 4줄이 전부 실패했는데, 팝업 검색만
 * 원문을 보여줘서 429(한도 초과)인 걸 알았고 나머지 3줄은 "폴백이에요" 만
 * 떴어요. **같은 원인인데 한 줄만 말해준 거예요.**
 *
 * ## 왜 payload 에 안 담나
 *
 * 추천 결과 같은 건 사용자 화면까지 내려가요. 거기에 오류 원문을 실으면
 * 진단용 정보가 일반 사용자에게까지 새요. 그래서 서버 안에만 두고,
 * **관리자 자기점검만 읽어가요.**
 *
 * ## 정확도의 한계
 *
 * 서버 인스턴스 하나에 담아두는 값이라, 동시에 다른 요청이 실패하면 그게
 * 덮어쓸 수 있어요. 그래서 읽는 쪽에서 **어느 기능인지(`where`)와 언제인지**
 * 를 확인해요 (`recentFailure`). 진단용 힌트라 이 정도면 충분하고, 확실한
 * 원본은 여전히 서버 로그예요.
 */

export interface AiFailure {
  /** 어느 기능에서 (recommend · scan · chat …) */
  where: string;
  kind: AiErrorKind;
  message: string;
  at: number;
}

let last: AiFailure | null = null;

/**
 * 실패를 로그에 남기고 기억해둬요.
 * 폴백으로 넘어가는 모든 자리에서 이걸 불러요 (`console.error` 대신).
 */
export function noteAiFailure(where: string, providerId: string, error: unknown): AiFailure {
  const err = toAiError(error);
  const failure: AiFailure = {
    where,
    kind: err.kind,
    // 원문이 길면(429 본문 등) 앞부분만 — 화면에 한 줄로 보여줄 거라
    message: err.message.slice(0, 300),
    at: Date.now(),
  };
  last = failure;
  console.error(`[ai/${where}] ${providerId} 실패 (${err.kind}): ${err.message}`);
  return failure;
}

/** 방금 그 기능이 실패한 이유. 오래됐거나 다른 기능 것이면 null. */
export function recentFailure(where: string, withinMs = 120_000): AiFailure | null {
  if (!last || last.where !== where) return null;
  return Date.now() - last.at <= withinMs ? last : null;
}

/** 사람이 읽을 한 줄로. 한도(429)면 무엇을 해야 하는지까지. */
export function failureHint(failure: AiFailure | null): string | null {
  if (!failure) return null;
  if (failure.kind === "rate_limit") {
    // gemini.ts 가 괄호 안에 분당/하루와 대기 시간을 넣어줘요
    const detail = /\(([^)]+)\)/.exec(failure.message)?.[1];
    // detail 자체가 이미 완성된 안내라 앞에 말을 더 붙이지 않아요
    // ("한도에 걸렸어요 — 오늘 무료 한도를 다 썼어요 — …" 처럼 대시가 겹쳐요)
    return detail ?? "AI 사용 한도에 걸렸어요 (429). 잠시 뒤 다시 눌러주세요.";
  }
  if (failure.kind === "auth") {
    return "키가 거부됐어요 (401/403). 키 값과, 그 키가 이 모델을 쓸 수 있는지 확인해주세요.";
  }
  return `호출이 실패했어요 — ${failure.message}`;
}
