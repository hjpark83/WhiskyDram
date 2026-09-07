import { rethrowIfFrameworkError } from "@/lib/next-error";
import type { PriceReport } from "@/lib/price/types";
import { createClient } from "@/lib/supabase/server";

/**
 * 시세 제보 읽기.
 *
 * 표가 아직 없거나 DB 가 잠깐 안 될 때도 화면이 죽지 않아요 — 빈 목록으로 돌려주고
 * "아직 제보가 없어요" 를 보여줘요. (팝업과 달리 예시 시드가 없어요. 가격은
 * 지어내면 사용자가 헛걸음하니까, 없으면 없다고 해야 해요.)
 */

interface Row {
  id: string;
  user_id: string;
  whisky_id: string;
  store: string;
  store_note: string | null;
  price_krw: number;
  volume_ml: number;
  seen_on: string;
  note: string | null;
}

function toReport(row: Row): PriceReport {
  return {
    id: row.id,
    userId: row.user_id,
    whiskyId: row.whisky_id,
    store: row.store,
    storeNote: row.store_note ?? "",
    priceKrw: row.price_krw,
    volumeMl: row.volume_ml,
    seenOn: row.seen_on,
    note: row.note ?? "",
  };
}

const COLUMNS = "id, user_id, whisky_id, store, store_note, price_krw, volume_ml, seen_on, note";

/** 최근 제보부터. limit 은 화면에 보여줄 만큼만. */
export async function listReports(options: { whiskyId?: string; limit?: number } = {}): Promise<PriceReport[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("price_reports")
      .select(COLUMNS)
      .order("seen_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 500);
    if (options.whiskyId) query = query.eq("whisky_id", options.whiskyId);

    const { data, error } = await query;
    if (error) {
      console.warn(`[price] 제보 조회 실패 (${error.code ?? "?"}): ${error.message}`);
      return [];
    }
    return (data ?? []).map((row) => toReport(row as unknown as Row));
  } catch (error) {
    rethrowIfFrameworkError(error);
    console.warn("[price] 제보 조회 중 오류", error);
    return [];
  }
}
