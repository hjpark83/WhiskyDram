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

const PHOTO_COLUMNS =
  "id, whisky_id, user_id, storage_path, image_url, source, source_url, credit, license, label_path, liquid_hex, approved, created_at";

export interface WhiskyPhoto {
  id: string;
  whiskyId: string;
  url: string;
  approved: boolean;
  /** 내가 올린 사진인지 (승인 대기 안내를 보여주려고) */
  mine: boolean;
  /** scan/upload = 사용자 사진, commons = 위키미디어 커먼즈 */
  source: "scan" | "upload" | "commons";
  /** 커먼즈 사진은 출처를 반드시 밝혀야 해요 (라이선스 조건) */
  sourceUrl: string | null;
  credit: string | null;
  license: string | null;
  /** 사진에서 꺼낸 라벨 그림 — 3D 병에 감아요 */
  labelUrl: string | null;
  /** 사진에서 꺼낸 액체 색 (#rrggbb) */
  liquidHex: string | null;
  createdAt: string;
}

interface PhotoRow {
  id: string;
  whisky_id: string;
  user_id: string;
  /** 사용자가 올린 사진 (우리 Storage) */
  storage_path: string | null;
  /** 커먼즈처럼 바깥에 있는 사진 */
  image_url: string | null;
  source: WhiskyPhoto["source"];
  source_url: string | null;
  credit: string | null;
  license: string | null;
  label_path: string | null;
  liquid_hex: string | null;
  approved: boolean;
  created_at: string;
}

function publicUrl(supabase: SupabaseClient, row: PhotoRow): string {
  // 커먼즈 사진은 주소를 그대로 가리켜요 (우리 Storage 에 파일이 없어요)
  if (row.image_url) return row.image_url;
  if (!row.storage_path) return "";
  return supabase.storage.from(BOTTLE_PHOTO_BUCKET).getPublicUrl(row.storage_path).data.publicUrl;
}

function toPhoto(
  supabase: SupabaseClient,
  row: PhotoRow,
  viewerId: string | null,
): WhiskyPhoto {
  return {
    id: row.id,
    whiskyId: row.whisky_id,
    url: publicUrl(supabase, row),
    approved: row.approved,
    mine: row.user_id === viewerId,
    source: row.source ?? "scan",
    sourceUrl: row.source_url,
    credit: row.credit,
    license: row.license,
    labelUrl: row.label_path
      ? supabase.storage.from(BOTTLE_PHOTO_BUCKET).getPublicUrl(row.label_path).data.publicUrl
      : null,
    liquidHex: row.liquid_hex,
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
    .select(PHOTO_COLUMNS)
    .eq("whisky_id", whiskyId)
    .order("approved", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // 42P01 = 표가 아직 없음. schema.sql 을 안 돌린 것뿐이라 조용히 넘어가요.
    if (error.code !== "42P01") console.error("[photos] select failed", error);
    return [];
  }
  return (data ?? [])
    .map((row) => toPhoto(supabase, row as unknown as PhotoRow, viewerId))
    .filter((p) => p.url);
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
    .select("whisky_id, storage_path, image_url, created_at")
    .in("whisky_id", whiskyIds)
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code !== "42P01") console.error("[photos] cover select failed", error);
    return out;
  }
  for (const row of data ?? []) {
    const r = row as unknown as PhotoRow;
    // 정렬이 최신순이라 처음 만난 게 대표 사진이에요
    if (out.has(r.whisky_id)) continue;
    const url = publicUrl(supabase, r);
    if (url) out.set(r.whisky_id, url);
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
  // 돌려주는 건 저장 경로가 아니라 **행 id** 예요. 스캔 직후에 라벨·색을
  // 이어서 채워야 해서, 그때 어느 행인지 가리킬 수 있어야 하거든요.
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

  const { data, error } = await supabase
    .from("whisky_photos")
    .insert({
      whisky_id: params.whiskyId,
      user_id: params.userId,
      storage_path: path,
      source: params.source ?? "scan",
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[photos] insert failed", error);
    // 표에 못 넣었으면 올린 파일도 지워요 (주인 없는 파일이 남지 않게)
    await supabase.storage.from(BOTTLE_PHOTO_BUCKET).remove([path]);
    return null;
  }
  return data.id as string;
}

/** base64 → 바이트. 스캔은 이미 base64 로 이미지를 받고 있어요. */
export function bytesFromBase64(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
