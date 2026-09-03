import Anthropic from "@anthropic-ai/sdk";

/** 모델은 env 로 바꿀 수 있어요. 기본은 Claude Opus 5. */
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

let cached: Anthropic | null = null;

/** API 키가 없으면 null — 호출부에서 폴백 로직으로 넘어가요. */
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return null;
  cached ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  return cached;
}
