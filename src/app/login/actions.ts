"use server";

import { redirect } from "next/navigation";
import { AuthError } from "@supabase/supabase-js";
import { z } from "zod";
import { nicknameSchema } from "@/lib/auth/nickname";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
  /** 화면에서 후속 동작(확인 메일 재발송 등)을 띄울지 판단하는 데 써요 */
  code?: string;
} | null;

const credentialsSchema = z.object({
  email: z.email({ error: "올바른 이메일을 입력해주세요." }),
  password: z.string().min(6, { error: "비밀번호는 6자 이상이어야 해요." }),
});

/**
 * 로그인 실패 이유를 사람이 읽을 수 있게 바꿔요.
 *
 * 전에는 어떤 오류든 "이메일 또는 비밀번호가 맞지 않아요"로 뭉뚱그려서,
 * 메일 미확인이나 공급자 비활성화 같은 설정 문제를 구분할 수 없었어요.
 */
function describeAuthError(error: AuthError): { message: string; code: string } {
  const code = error.code ?? (error.status === 400 ? "invalid_credentials" : "unknown");
  const messages: Record<string, string> = {
    invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
    email_not_confirmed:
      "메일 확인이 아직 안 됐어요. 가입할 때 받은 메일의 링크를 눌러주세요. 메일이 없으면 아래에서 다시 보낼 수 있어요.",
    user_banned: "이 계정은 사용이 정지됐어요.",
    user_not_found: "가입되지 않은 이메일이에요. 회원가입 탭에서 먼저 가입해주세요.",
    email_provider_disabled: "이메일 로그인이 꺼져 있어요. Supabase 대시보드에서 Email 공급자를 켜주세요.",
    signup_disabled: "지금은 새 가입을 받지 않고 있어요.",
    over_request_rate_limit: "시도가 너무 많았어요. 잠시 후 다시 해주세요.",
    over_email_send_rate_limit: "메일을 너무 자주 보냈어요. 잠시 후 다시 해주세요.",
  };
  return { message: messages[code] ?? `로그인에 실패했어요 (${code}).`, code };
}

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
    // 실제 코드는 서버 로그에 남겨요 (설정 문제인지 비밀번호 문제인지 구분하려고)
    console.warn(`[auth] 로그인 실패 code=${error.code ?? "?"} status=${error.status ?? "?"}: ${error.message}`);
    const { message, code } = describeAuthError(error);
    return { error: message, code };
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
    console.warn(`[auth] 가입 실패 code=${error.code ?? "?"}: ${error.message}`);
    return describeAuthError(error);
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

/** 확인 메일을 다시 보내요 (가입은 됐는데 메일 링크를 못 누른 경우). */
export async function resendConfirmation(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "이메일을 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    console.warn(`[auth] 확인 메일 재발송 실패 code=${error.code ?? "?"}: ${error.message}`);
    return describeAuthError(error);
  }
  return { message: "확인 메일을 다시 보냈어요. 메일함(스팸함도)을 확인해주세요." };
}
