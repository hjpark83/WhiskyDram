import { NextResponse } from "next/server";

// Reports which env vars are present (never their values) so deployment
// misconfiguration can be diagnosed without dashboard access.
export async function GET() {
  const present = (name: string) => Boolean(process.env[name]?.trim());
  return NextResponse.json({
    ok: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      ANTHROPIC_API_KEY: present("ANTHROPIC_API_KEY"),
      NEXT_PUBLIC_SITE_URL: present("NEXT_PUBLIC_SITE_URL"),
    },
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
