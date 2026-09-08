import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 사용자가 찍은 실물 병 사진.
 *
 * 판매 사이트의 제품 이미지는 수입사·유통사 자산이라 가져다 쓸 수 없어요.
 * 대신 **본인이 찍은 사진은 본인 것**이라, 병을 스캔할 때 올린 사진을 그
 * 병의 사진으로 쌓아요. 사진이 없는 병은 그려둔 병 그림(BottleArt)으로 보여줘요.
 *
 * 남이 볼 화면에 올라가는 사진이라 공개는 사람이 확인한 뒤에 해요. 올린 본인은
 * 승인 전에도 자기 사진이 보여요 (RLS 가 그렇게 잡혀 있어요).
 */

export const BOTTLE_PHOTO_BUCKET = "bottle-photos";

/** 사진 한 장이 넘을 수 없는 크기 (원본 그대로 올리면 데이터가 아까워요) */
export const MAX_PHOTO_BYTES = 3_000_000;

export interface WhiskyPhoto {
  id: string;
  whiskyId: string;
  url: string;
  approved: boolean;
  /** 내가 올린 사진인지 (승인 대기 안내를 보여주려고) */
  mine: boolean;
  createdAt: string;
}

interface PhotoRow {
  id: string;
  whisky_id: string;
  user_id: string;
  storage_path: string;
  approved: boolean;
  created_at: string;
}

function toPhoto(
  supabase: SupabaseClient,
  row: PhotoRow,
  viewerId: string | null,
): WhiskyPhoto {
  const { data } = supabase.storage.from(BOTTLE_PHOTO_BUCKET).getPublicUrl(row.storage_path);
  return {
    id: row.id,
    whiskyId: row.whisky_id,
    url: data.publicUrl,
    approved: row.approved,
    mine: row.user_id === viewerId,
    createdAt: row.created_at,
  };
}

/**
 * 그 병의 사진들. 승인된 것이 먼저, 그다음 내가 올린 대기 중인 것.
 *
 * 표가 아직 없는 배포에서도 화면이 죽지 않게 오류는 조용히 삼켜요
 * (schema.sql 을 아직 안 돌린 상태여도 병 그림으로 잘 보여요).
 */
export async function getWhiskyPhotos(
  supabase: SupabaseClient,
  whiskyId: string,
  viewerId: string | null,
  limit = 6,
): Promise<WhiskyPhoto[]> {
  const { data, error } = await supabase
    .from("whisky_photos")
    .select("id, whisky_id, user_id, storage_path, approved, created_at")
    .eq("whisky_id", whiskyId)
    .order("approved", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // 42P01 = 표가 아직 없음. schema.sql 을 안 돌린 것뿐이라 조용히 넘어가요.
    if (error.code !== "42P01") console.error("[photos] select failed", error);
    return [];
  }
  return (data ?? []).map((row) => toPhoto(supabase, row as PhotoRow, viewerId));
}

/** 여러 병의 대표 사진을 한 번에 (목록 화면용) */
export async function getCoverPhotos(
  supabase: SupabaseClient,
  whiskyIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (whiskyIds.length === 0) return out;

  const { data, error } = await supabase
    .from("whisky_photos")
    .select("whisky_id, storage_path, created_at")
    .in("whisky_id", whiskyIds)
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code !== "42P01") console.error("[photos] cover select failed", error);
    return out;
  }
  for (const row of data ?? []) {
    const r = row as { whisky_id: string; storage_path: string };
    // 정렬이 최신순이라 처음 만난 게 대표 사진이에요
    if (out.has(r.whisky_id)) continue;
    const { data: pub } = supabase.storage.from(BOTTLE_PHOTO_BUCKET).getPublicUrl(r.storage_path);
    out.set(r.whisky_id, pub.publicUrl);
  }
  return out;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * 스캔에 쓴 사진을 그 병의 사진으로 저장.
 *
 * 실패해도 스캔 결과는 그대로 보여줘야 해서, 오류를 던지지 않고 null 을 돌려줘요.
 * 사진 한 장 저장에 실패했다고 방금 인식한 결과를 못 보면 이상하잖아요.
 */
export async function saveBottlePhoto(
  supabase: SupabaseClient,
  params: {
    userId: string;
    whiskyId: string;
    bytes: Uint8Array;
    mediaType: string;
    source?: "scan" | "upload";
  },
): Promise<string | null> {
  const ext = EXT[params.mediaType];
  if (!ext) return null;
  if (params.bytes.byteLength > MAX_PHOTO_BYTES) return null;

  const path = `${params.userId}/${params.whiskyId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BOTTLE_PHOTO_BUCKET)
    .upload(path, params.bytes, { contentType: params.mediaType, upsert: false });
  if (upErr) {
    console.error("[photos] upload failed", upErr);
    return null;
  }

  const { error } = await supabase.from("whisky_photos").insert({
    whisky_id: params.whiskyId,
    user_id: params.userId,
    storage_path: path,
    source: params.source ?? "scan",
  });
  if (error) {
    console.error("[photos] insert failed", error);
    // 표에 못 넣었으면 올린 파일도 지워요 (주인 없는 파일이 남지 않게)
    await supabase.storage.from(BOTTLE_PHOTO_BUCKET).remove([path]);
    return null;
  }
  return path;
}

/** base64 → 바이트. 스캔은 이미 base64 로 이미지를 받고 있어요. */
export function bytesFromBase64(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
