import { redirect } from "next/navigation";
import { rethrowIfFrameworkError } from "@/lib/next-error";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 확인.
 *
 * 관리자 명단은 Supabase `admins` 표에 있고, 본인 행만 읽을 수 있게 RLS 가 걸려 있어요
 * (supabase/schema.sql). 표가 아직 없으면 그냥 "관리자 아님" 으로 봐요.
 */
export interface AdminUser {
  id: string;
  email: string | null;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  // 이 함수는 로그인한 모든 페이지의 레이아웃에서 돌아요.
  // 여기서 예외가 새면 사이트 전체가 500 이 나므로, 실패하면 "관리자 아님"으로 넘어가요.
  // (스키마를 아직 안 돌려 admins 표가 없거나, DB 가 잠깐 안 될 때)
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.warn(`[auth/admin] admins 조회 실패 (${error.code ?? "?"}): ${error.message}`);
      return null;
    }
    if (!data) return null;
    return { id: user.id, email: user.email ?? null };
  } catch (error) {
    rethrowIfFrameworkError(error);
    console.warn("[auth/admin] 관리자 확인 중 오류", error);
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminUser()) !== null;
}

/** 관리자가 아니면 홈으로 보내요. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) redirect("/home");
  return admin;
}
