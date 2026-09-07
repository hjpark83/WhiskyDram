import { NextResponse } from "next/server";
import { activeProvider, configuredProviders } from "@/lib/ai/provider";

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
