"use server";

import { revalidatePath } from "next/cache";
import { nicknameSchema } from "@/lib/auth/nickname";
import { personaSchema } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; message?: string } | null;

/** 닉네임 바꾸기. 사이트 전체에서 이 이름으로 불러요. */
export async function updateNickname(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = nicknameSchema.safeParse(formData.get("nickname") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", user.id);
  if (error) {
    return { error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  // 다음에 가입 정보를 읽을 때도 같은 이름이 나오게 맞춰둬요
  await supabase.auth.updateUser({ data: { display_name: parsed.data } });

  revalidatePath("/settings");
  revalidatePath("/home");
  return { message: `이제 ${parsed.data}님으로 불러드릴게요.` };
}

/**
 * 내 정보 저장.
 *
 * 성별은 저장만 하고 추천 계산·프롬프트에는 쓰지 않아요 (src/lib/ai/persona.ts).
 * 성별로 취향을 가르면 추천이 오히려 나빠져서요.
 */
export async function updatePersona(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = personaSchema.safeParse({
    ageBand: String(formData.get("ageBand") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    scenes: formData.getAll("scenes").map(String),
    likes: String(formData.get("likes") ?? ""),
    avoids: String(formData.get("avoids") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { error } = await supabase
    .from("profiles")
    .update({
      age_band: parsed.data.ageBand || null,
      gender: parsed.data.gender || null,
      drink_scenes: parsed.data.scenes,
      likes_note: parsed.data.likes || null,
      avoids_note: parsed.data.avoids || null,
    })
    .eq("id", user.id);
  if (error) {
    console.warn(`[settings] 내 정보 저장 실패 (${error.code ?? "?"}): ${error.message}`);
    return {
      error:
        error.code === "42703"
          ? "내 정보 칸이 아직 DB에 없어요. 관리자가 supabase/schema.sql 을 실행해야 해요."
          : "저장하지 못했어요. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/recommend");
  return { message: "저장했어요. 다음 추천부터 반영돼요." };
}
