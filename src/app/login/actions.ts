"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | null;

const credentialsSchema = z.object({
  email: z.email({ error: "올바른 이메일을 입력해주세요." }),
  password: z.string().min(6, { error: "비밀번호는 6자 이상이어야 해요." }),
});

/** 화면에 보일 이름. 사이트 전체에서 이 이름으로 불러요. */
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, { error: "닉네임은 2자 이상이어야 해요." })
  .max(12, { error: "닉네임은 12자까지 쓸 수 있어요." });

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "이메일 또는 비밀번호가 맞지 않아요." };
  }

  const next = (formData.get("next") as string | null) || "/home";
  redirect(next);
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }
  const nickname = nicknameSchema.safeParse(formData.get("nickname") ?? "");
  if (!nickname.success) {
    return { error: nickname.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      // 트리거(handle_new_user)가 이 값을 읽어 profiles.display_name 에 넣어요
      data: { display_name: nickname.data },
    },
  });
  if (error) {
    return { error: error.message };
  }

  // If email confirmation is disabled in Supabase, a session is returned immediately.
  if (data.session) {
    redirect("/home");
  }
  return { message: "확인 메일을 보냈어요. 메일함에서 링크를 눌러 가입을 완료해주세요." };
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = (formData.get("next") as string | null) || "/home";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}
