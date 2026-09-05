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
  constructor(
    message: string,
    readonly kind: AiErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
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
