"use server";

import { z } from "zod";
import { getWhisky } from "@/data/whiskies";
import { scanBottle, type ScanPayload } from "@/lib/ai/scan";
import { createClient } from "@/lib/supabase/server";
import { formatPriceRange, TYPE_SHORT_KO } from "@/lib/whisky/format";
import { BOTTLE_PHOTO_BUCKET, bytesFromBase64, saveBottlePhoto } from "@/lib/whisky/photos";
import { hasProfile } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile, type Whisky } from "@/lib/whisky/types";

const inputSchema = z.object({
  imageBase64: z.string().min(100).max(6_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export interface ScanWhiskySummary {
  id: string;
  nameKo: string;
  name: string;
  typeLabel: string;
  price: string;
  abv: number;
  styles: Whisky["styles"];
  beginnerTip: string;
}

export type ScanResult =
  | {
      ok: true;
      result: ScanPayload;
      whisky: ScanWhiskySummary | null;
      alternatives: ScanWhiskySummary[];
      personalized: boolean;
      /** 방금 저장한 사진 행. 라벨·색을 이어서 채우려고 돌려줘요. */
      photoId: string | null;
    }
  | { ok: false; error: string };

function summarize(w: Whisky): ScanWhiskySummary {
  return {
    id: w.id,
    nameKo: w.nameKo,
    name: w.name,
    typeLabel: TYPE_SHORT_KO[w.type],
    price: formatPriceRange(w.priceKrw),
    abv: w.abv,
    styles: w.styles,
    beginnerTip: w.beginnerTip,
  };
}

export async function submitScan(raw: z.infer<typeof inputSchema>): Promise<ScanResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "사진을 다시 골라주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("taste_profile")
    .eq("id", user.id)
    .maybeSingle();
  const stored = (profileRow?.taste_profile as Partial<TasteProfile> | null) ?? null;
  const profile: TasteProfile | null = hasProfile(stored)
    ? { ...EMPTY_TASTE_PROFILE, ...stored }
    : null;

  const result = await scanBottle({
    imageBase64: parsed.data.imageBase64,
    mediaType: parsed.data.mediaType,
    profile,
  });

  if (result.generatedBy === "fallback") {
    return {
      ok: false,
      error: "지금은 사진 인식을 할 수 없어요. 아래 검색으로 병 이름을 찾아보세요.",
    };
  }

  let photoId: string | null = null;
  const whisky = result.whiskyId ? getWhisky(result.whiskyId) : undefined;
  const alternatives = result.alternatives
    .map((id) => getWhisky(id))
    .filter((w): w is Whisky => Boolean(w))
    .map(summarize);

  if (whisky) {
    // 기록만 남겨요 (실패해도 사용자 흐름은 막지 않아요)
    const { error } = await supabase.from("recommendations").insert({
      user_id: user.id,
      source: "scan",
      whisky_ids: [whisky.id],
      payload: result,
    });
    if (error) console.error("[scan] insert failed", error);

    // 방금 찍은 사진을 그 병의 실물 사진으로 쌓아요. 확신이 없는 인식으로
    // 엉뚱한 병에 사진을 붙이면 안 되니, 확신도가 높을 때만 저장해요.
    // 저장에 실패해도 스캔 결과는 그대로 보여줘요.
    if (result.confidence === "high") {
      photoId = await saveBottlePhoto(supabase, {
        userId: user.id,
        whiskyId: whisky.id,
        bytes: bytesFromBase64(parsed.data.imageBase64),
        mediaType: parsed.data.mediaType,
        source: "scan",
      });
    }
  }

  return {
    ok: true,
    result,
    whisky: whisky ? summarize(whisky) : null,
    alternatives,
    personalized: profile !== null,
    photoId,
  };
}


/**
 * 사진에서 꺼낸 라벨 그림과 액체 색을 방금 저장한 사진에 채워요.
 *
 * 브라우저에서 캔버스로 잘라 보낸 결과만 받아요 — 원본을 다시 올리지 않아요.
 * 실패해도 조용히 넘어가요. 스캔은 이미 끝났고, 이건 3D 병을 더 예쁘게 하는
 * 덤이라 여기서 오류를 띄우면 사용자만 놀라요.
 */
const appearanceSchema = z.object({
  photoId: z.string().uuid(),
  whiskyId: z.string().min(1),
  labelPng: z.string().startsWith("data:image/png;base64,").max(4_000_000).nullable(),
  liquidHex: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
});

export async function saveScanAppearance(raw: unknown): Promise<void> {
  const parsed = appearanceSchema.safeParse(raw);
  if (!parsed.success) return;
  const { photoId, whiskyId, labelPng, liquidHex } = parsed.data;
  if (!labelPng && !liquidHex) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  let labelPath: string | null = null;
  if (labelPng) {
    const bytes = bytesFromBase64(labelPng.split(",")[1] ?? "");
    const path = `${user.id}/${whiskyId}/label-${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage
      .from(BOTTLE_PHOTO_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (error) console.error("[scan] 라벨 그림 업로드 실패", error);
    else labelPath = path;
  }

  const { error } = await supabase
    .from("whisky_photos")
    .update({
      ...(labelPath ? { label_path: labelPath } : {}),
      ...(liquidHex ? { liquid_hex: liquidHex.toLowerCase() } : {}),
    })
    .eq("id", photoId)
    .eq("user_id", user.id);
  if (error) console.error("[scan] 라벨·색 저장 실패", error);
}
