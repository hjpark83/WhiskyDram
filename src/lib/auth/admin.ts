import { redirect } from "next/navigation";
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
  if (error || !data) return null;
  return { id: user.id, email: user.email ?? null };
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
