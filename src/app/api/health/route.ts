import { NextResponse } from "next/server";
import { activeProvider, configuredProviders } from "@/lib/ai/provider";

// Reports which env vars are present (never their values) so deployment
// misconfiguration can be diagnosed without dashboard access.
export async function GET() {
  const present = (name: string) => Boolean(process.env[name]?.trim());
  const active = activeProvider();
  return NextResponse.json({
    ok: true,
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
    },
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
