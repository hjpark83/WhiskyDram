import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasSupabaseConfig, SUPABASE_CONFIG_MESSAGE } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : "/home";
  const error = typeof searchParams.error === "string" ? searchParams.error : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-2 text-2xl font-bold">
            🥃 FirstDram
          </Link>
          <CardTitle>시작하기</CardTitle>
          <CardDescription>
            취향을 기억하려면 로그인이 필요해요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasSupabaseConfig() && (
            <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {SUPABASE_CONFIG_MESSAGE}
            </p>
          )}
          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error === "oauth"
                ? "구글 로그인을 아직 쓸 수 없어요. Supabase 대시보드에서 Google 공급자를 켜주세요."
                : error === "config"
                  ? SUPABASE_CONFIG_MESSAGE
                  : "로그인에 실패했어요. 다시 시도해주세요."}
            </p>
          )}
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
