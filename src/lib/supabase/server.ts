import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 배포에 Supabase 주소·키가 들어 있는지.
 *
 * 이게 비어 있으면 `createClient()` 가 예외를 던지고, 그걸 쓰는 모든 서버 액션과
 * 로그인 영역 페이지가 통째로 500 이 나요. 로그인 화면 자체는 createClient 를
 * 안 써서 멀쩡히 보이기 때문에 "로그인만 안 되네"처럼 보여요.
 * (Vercel 에서 환경변수를 Production 에만 넣고 Preview 에는 안 넣었을 때 흔해요.)
 */
export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export const SUPABASE_CONFIG_MESSAGE =
  "사이트 설정이 비어 있어요 (Supabase 주소·키). Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 Production·Preview 양쪽에 넣고 다시 배포해주세요.";

export async function createClient() {
  // cookies() 를 **먼저** 불러야 해요. 이게 Next 에 "이 페이지는 동적"이라고 알리는 신호라,
  // 앞에서 다른 예외를 던지면 빌드 때 프리렌더 실패로 잡혀서 배포 자체가 깨져요.
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    // 기본 오류("supabaseUrl is required")는 원인을 알아보기 어려워요
    throw new Error(
      `[supabase] 환경변수가 없어요 — URL:${url ? "있음" : "없음"} KEY:${anonKey ? "있음" : "없음"}. ${SUPABASE_CONFIG_MESSAGE}`,
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — cookies are read-only there.
          // Session refresh is handled by proxy.ts, so this is safe to ignore.
        }
      },
    },
  });
}
