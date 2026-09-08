import { NextResponse } from "next/server";
import { activeProvider, configuredProviders } from "@/lib/ai/provider";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/server";

/**
 * 지금 이 요청을 보낸 **본인** 정보. 남의 정보는 절대 안 나와요 —
 * 요청에 실려온 쿠키로 조회하니까 각자 자기 것만 봐요.
 *
 * "관리자 권한이 왜 안 붙지" 를 추측으로 찾지 않으려고 넣었어요.
 * admins 표에 행이 있어도 **다른 계정으로 로그인**해 있으면 소용이 없는데,
 * 화면만 봐서는 그걸 구분할 수가 없었어요.
 */
/**
 * schema.sql 을 돌렸는지 확인해요.
 *
 * "저장이 안 돼요" 의 상당수가 사실 **새 표·칸이 아직 DB에 없는 것**인데,
 * 화면만 봐서는 그걸 알 수가 없었어요. 각 표를 0줄만 조회해보고 오류 코드로 판단해요
 * (42P01 = 그런 표 없음, 42703 = 그런 칸 없음).
 */
async function schemaReady() {
  if (!hasSupabaseConfig()) return null;
  try {
    const supabase = await createClient();
    const probe = async (table: string, columns: string) => {
      const { error } = await supabase.from(table).select(columns).limit(0);
      if (!error) return true;
      if (error.code === "42P01" || error.code === "42703") return false;
      // 권한 문제 등은 "없다" 와 다르니 그대로 알려줘요
      return `${error.code ?? "?"}: ${error.message}`;
    };

    const [profilesPersona, priceReports, popupStores, admins] = await Promise.all([
      probe("profiles", "age_band, drink_scenes, likes_note"),
      probe("price_reports", "id"),
      probe("popup_stores", "id"),
      probe("admins", "user_id"),
    ]);

    const missing = [
      profilesPersona === false && "profiles 의 내 정보 칸 (age_band 등)",
      priceReports === false && "price_reports 표 (위스키 시세)",
      popupStores === false && "popup_stores 표 (팝업 스토어)",
      admins === false && "admins 표 (관리자)",
    ].filter(Boolean);

    return {
      profilesPersona,
      priceReports,
      popupStores,
      admins,
      hint:
        missing.length > 0
          ? `아직 없는 것: ${missing.join(", ")} — supabase/schema.sql 을 Supabase SQL Editor 에서 실행해주세요 (여러 번 돌려도 안전해요).`
          : null,
    };
  } catch {
    return null;
  }
}

async function whoami() {
  if (!hasSupabaseConfig()) return { loggedIn: false, reason: "Supabase 설정이 없어요" };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { loggedIn: false, reason: "로그인하지 않았어요" };

    const { data, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return {
      loggedIn: true,
      userId: user.id,
      email: user.email ?? null,
      provider: user.app_metadata?.provider ?? null,
      isAdmin: Boolean(data),
      adminLookupError: error ? `${error.code ?? "?"}: ${error.message}` : null,
      hint: data
        ? null
        : "이 user id 가 public.admins 에 있어야 관리자예요. supabase/check-admin.sql 로 확인해보세요.",
    };
  } catch (error) {
    return { loggedIn: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 배포 진단용. 어떤 환경변수가 **있는지만** 알려주고 값은 절대 안 보여줘요.
 *
 * `deployment` 를 같이 돌려주는 이유: Vercel 의 `whisky-dram-<해시>-...` 주소는
 * 그때 그때 고정된 배포라, 환경변수를 새로 넣어도 **그 주소는 영원히 예전 상태**예요.
 * 그래서 "키를 넣었는데 안 되네" 의 절반은 사실 옛 배포를 보고 있는 거예요.
 * 커밋 해시를 보면 지금 보는 화면이 최신인지 바로 알 수 있어요.
 */
export async function GET() {
  const present = (name: string) => Boolean(process.env[name]?.trim());
  const active = activeProvider();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  return NextResponse.json({
    ok: true,
    you: await whoami(),
    db: await schemaReady(),
    deployment: {
      // 지금 이 화면이 어느 커밋인지 — 최신 main 과 다르면 옛 배포를 보고 있는 거예요
      commit: sha ? sha.slice(0, 7) : null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
      env: process.env.VERCEL_ENV ?? null,
      url: process.env.VERCEL_URL ?? null,
    },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      NEXT_PUBLIC_SITE_URL: present("NEXT_PUBLIC_SITE_URL"),
      ANTHROPIC_API_KEY: present("ANTHROPIC_API_KEY"),
      OPENAI_API_KEY: present("OPENAI_API_KEY"),
      GEMINI_API_KEY: present("GEMINI_API_KEY") || present("GOOGLE_API_KEY"),
    },
    ai: {
      // 실제로 쓰이는 프로바이더와, 키가 있어서 고를 수 있는 것들
      active: active ? { provider: active.id, model: active.model } : null,
      configured: configuredProviders().map((p) => p.id),
      override: process.env.AI_PROVIDER ?? null,
      // 개발용 가짜 서버 주소가 배포에 남아 있으면 모든 Gemini 호출이 죽어요
      baseUrlOverride: process.env.GEMINI_BASE_URL ?? null,
    },
    // 무엇을 고쳐야 하는지 한 줄로
    hint: active
      ? null
      : "AI 키가 안 잡혔어요. Vercel → Settings → Environment Variables 에서 GEMINI_API_KEY 가 Production 에도 체크돼 있는지 보고, 고쳤으면 캐시 없이 다시 배포해주세요. deployment.commit 이 최신 main 과 다르면 옛 배포를 보고 있는 거예요.",
  });
}
