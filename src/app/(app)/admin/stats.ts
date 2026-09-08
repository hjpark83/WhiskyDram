import { rethrowIfFrameworkError } from "@/lib/next-error";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 화면의 숫자들.
 *
 * RLS 때문에 관리자도 남의 profiles·notes 를 직접 읽을 수 없어요 (그게 맞아요 —
 * 개인 기록이니까요). 그래서 **숫자만** 돌려주는 security definer 함수를 부르고,
 * 권한 확인은 함수 안에서 해요. 개별 사용자의 취향이나 후기 내용은 안 나와요.
 */

export interface AdminOverview {
  users: number;
  usersNew7d: number;
  profiles: number;
  withTaste: number;
  withPersona: number;
  notes: number;
  notes7d: number;
  recommendations: number;
  priceReports: number;
  priceReports7d: number;
  pricedWhiskies: number;
  admins: number;
}

export interface TopWhisky {
  whiskyId: string;
  notes: number;
  avgRating: number | null;
}

/** 함수가 아직 DB에 없으면 null — 화면은 "스키마를 실행해주세요" 를 보여줘요 */
export async function getOverview(): Promise<AdminOverview | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_overview");
    if (error) {
      console.warn(`[admin] 통계 조회 실패 (${error.code ?? "?"}): ${error.message}`);
      return null;
    }
    return data as AdminOverview;
  } catch (error) {
    rethrowIfFrameworkError(error);
    return null;
  }
}

export async function getTopWhiskies(limit = 8): Promise<TopWhisky[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_top_whiskies", { limit_count: limit });
    if (error) {
      console.warn(`[admin] 인기 위스키 조회 실패 (${error.code ?? "?"}): ${error.message}`);
      return [];
    }
    return ((data ?? []) as { whisky_id: string; notes: number; avg_rating: number | null }[]).map((r) => ({
      whiskyId: r.whisky_id,
      notes: Number(r.notes),
      avgRating: r.avg_rating === null ? null : Number(r.avg_rating),
    }));
  } catch (error) {
    rethrowIfFrameworkError(error);
    return [];
  }
}
