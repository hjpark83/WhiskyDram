/**
 * Next.js 는 리다이렉트·동적 렌더 전환 같은 흐름 제어를 예외로 던져요 (digest 가 붙어요).
 * DB 오류를 삼키는 try/catch 가 이것까지 삼키면 페이지가 이상하게 동작하니 다시 던져야 해요.
 */
export function rethrowIfFrameworkError(error: unknown): void {
  if (typeof (error as { digest?: unknown } | null)?.digest === "string") throw error;
}
