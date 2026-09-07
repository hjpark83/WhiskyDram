"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STORES, VOLUMES_ML } from "@/data/stores";
import { getWhisky } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";

export type PriceState = { error?: string; message?: string } | null;

const reportSchema = z.object({
  whiskyId: z.string().refine((v) => Boolean(getWhisky(v)), "사전에 없는 위스키예요."),
  store: z.string().refine((v) => STORES.some((s) => s.id === v), "매장을 골라주세요."),
  storeNote: z.string().trim().max(40, "지점 이름이 너무 길어요.").default(""),
  priceKrw: z
    .number({ error: "가격을 숫자로 적어주세요." })
    .int()
    .min(5_000, "5천 원보다 싼 위스키는 없을 거예요. 다시 확인해주세요.")
    .max(5_000_000, "500만 원이 넘으면 관리자에게 알려주세요."),
  volumeMl: z.number().int().refine((v) => (VOLUMES_ML as readonly number[]).includes(v), "용량을 골라주세요."),
  seenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라주세요.")
    .refine((v) => v <= new Date().toISOString().slice(0, 10), "미래 날짜는 넣을 수 없어요.")
    .refine((v) => v >= "2020-01-01", "너무 오래된 날짜예요."),
  note: z.string().trim().max(200, "메모가 너무 길어요.").default(""),
});

/** 시세 제보하기. 같은 날 같은 매장의 같은 병은 덮어써요. */
export async function submitReport(_prev: PriceState, formData: FormData): Promise<PriceState> {
  const parsed = reportSchema.safeParse({
    whiskyId: String(formData.get("whiskyId") ?? ""),
    store: String(formData.get("store") ?? ""),
    storeNote: String(formData.get("storeNote") ?? ""),
    priceKrw: Number(String(formData.get("priceKrw") ?? "").replace(/[^\d]/g, "")),
    volumeMl: Number(formData.get("volumeMl") ?? 700),
    seenOn: String(formData.get("seenOn") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "제보하려면 로그인이 필요해요." };

  const row = {
    user_id: user.id,
    whisky_id: parsed.data.whiskyId,
    store: parsed.data.store,
    store_note: parsed.data.storeNote || null,
    price_krw: parsed.data.priceKrw,
    volume_ml: parsed.data.volumeMl,
    seen_on: parsed.data.seenOn,
    note: parsed.data.note || null,
  };

  const { error } = await supabase
    .from("price_reports")
    .upsert(row, { onConflict: "user_id,whisky_id,store,seen_on" });
  if (error) {
    console.warn(`[price] 제보 저장 실패 (${error.code ?? "?"}): ${error.message}`);
    return {
      error:
        error.code === "42P01"
          ? "시세 표가 아직 없어요. 관리자가 supabase/schema.sql 을 실행해야 해요."
          : "저장하지 못했어요. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath("/price");
  revalidatePath(`/price/${parsed.data.whiskyId}`);
  return { message: "제보 고마워요! 다른 분들 시세에 바로 반영됐어요." };
}

/** 내 제보 지우기 (관리자는 엉터리 제보도 지울 수 있어요 — RLS 로 막혀 있어요) */
export async function deleteReport(_prev: PriceState, formData: FormData): Promise<PriceState> {
  const id = String(formData.get("id") ?? "");
  const whiskyId = String(formData.get("whiskyId") ?? "");
  if (!id) return { error: "무엇을 지울지 알 수 없어요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { error } = await supabase.from("price_reports").delete().eq("id", id);
  if (error) return { error: "지우지 못했어요." };

  revalidatePath("/price");
  if (whiskyId) revalidatePath(`/price/${whiskyId}`);
  return { message: "제보를 지웠어요." };
}
