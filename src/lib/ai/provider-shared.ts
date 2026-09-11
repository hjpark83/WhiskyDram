import type { z } from "zod";

/**
 * 프로바이더 구현들이 함께 쓰는 타입과 오류.
 * (provider.ts ↔ gemini.ts 가 서로를 import 하지 않도록 여기에 모아뒀어요.)
 */

export type AiProviderId = "anthropic" | "openai" | "gemini";

export interface ProviderInfo {
  id: AiProviderId;
  /** 화면에 보여줄 이름 */
  label: string;
  model: string;
}

export type AiErrorKind = "rate_limit" | "auth" | "refusal" | "other";

export class AiError extends Error {
  // 생성자 파라미터 프로퍼티(readonly kind: …) 대신 본문에서 대입해요.
  // 그래야 타입만 벗겨내는 도구(node --experimental-strip-types)로도 돌아가서
  // 점검 스크립트가 앱 코드를 그대로 불러올 수 있어요.
  readonly kind: AiErrorKind;
  readonly status?: number;
  /**
   * 사람에게 그대로 보여줄 안내 문구 (있으면).
   *
   * 예전엔 이 안내를 `message` 안에 괄호로 넣고, 화면에서 정규식으로 다시
   * 뽑아 썼어요. **그게 깨졌어요** — 안내문 안에 괄호가 또 있으면
   * `\(([^)]+)\)` 가 첫 닫는 괄호에서 끊겨서 문장이 잘렸어요
   * ("…하루 한도예요(한국 시간 오후 4~5시쯤 초기화돼요" 까지만 나옴).
   *
   * 그래서 파싱하지 않고 **따로 들고 다녀요.**
   */
  readonly hint?: string;

  constructor(message: string, kind: AiErrorKind, status?: number, hint?: string) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.status = status;
    this.hint = hint;
  }
}

export interface AiImage {
  /** image/jpeg, image/png … */
  mediaType: string;
  base64: string;
}

export interface JsonRequest<T> {
  system: string;
  user: string;
  images?: AiImage[];
  schema: z.ZodType<T>;
  /** 스키마 이름 (영문·숫자·_-) */
  schemaName: string;
  maxTokens?: number;
  /** Claude 에서만 의미가 있어요 */
  effort?: "low" | "medium" | "high";
}

export interface JsonResponse<T> {
  data: T;
  model: string;
  provider: AiProviderId;
}

export interface AiToolDef {
  name: string;
  description: string;
  /** JSON Schema (object) */
  inputSchema: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  input: unknown;
  /**
   * 프로바이더가 이 호출에 붙여준 불투명 토큰. 다음 요청에 **그대로 돌려줘야** 해요.
   * Gemini 3.x 는 functionCall 파트의 `thoughtSignature` 를 되돌려받지 못하면
   * 400 으로 거절해요. Claude·OpenAI 는 이런 게 없어서 비어 있어요.
   */
  signature?: string;
}

export interface AiToolResult {
  id: string;
  name: string;
  content: string;
}

/** 프로바이더에 상관없는 대화 기록 */
export type AiTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: AiToolCall[] }
  | { role: "tool"; results: AiToolResult[] };

export interface StreamRequest {
  system: string;
  turns: AiTurn[];
  tools: AiToolDef[];
  maxTokens?: number;
  /** 글자가 도착할 때마다 불려요 */
  onText: (delta: string) => void;
}

export interface StreamResult {
  text: string;
  toolCalls: AiToolCall[];
  model: string;
}

/** 사용자에게 보여줄 한국어 문구 */
export function userMessageFor(kind: AiErrorKind): string {
  switch (kind) {
    case "rate_limit":
      return "지금 요청이 많아요. 잠시 후 다시 시도해주세요.";
    case "auth":
      return "AI 키 설정에 문제가 있어요. 관리자에게 알려주세요.";
    case "refusal":
      return "그 질문에는 답하기 어려워요. 위스키 이야기로 돌아와볼까요?";
    default:
      return "AI 응답을 받지 못했어요. 잠시 후 다시 시도해주세요.";
  }
}
