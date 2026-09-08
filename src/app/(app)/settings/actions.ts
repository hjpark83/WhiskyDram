"use server";

import { revalidatePath } from "next/cache";
import { nicknameSchema } from "@/lib/auth/nickname";
import { personaSchema } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; message?: string } | null;

/** 저장이 왜 실패했는지 사용자가 할 수 있는 말로 옮겨요 */
function saveErrorMessage(code: string | undefined): string {
  // 42703 = 그런 칸 없음, 42P01 = 그런 표 없음 → 스키마를 아직 안 돌린 거예요
  if (code === "42703" || code === "42P01") {
    return "DB에 아직 새 칸이 없어요. supabase/schema.sql 을 Supabase SQL Editor 에서 실행해주세요.";
  }
  if (code === "42501") return "권한이 없어요. 로그인을 다시 해보세요.";
  return "저장하지 못했어요. 잠시 후 다시 시도해주세요.";
}

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

  // 여기도 upsert — 행이 없는 계정이면 update 는 조용히 아무것도 안 해요
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, display_name: parsed.data }, { onConflict: "id" })
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn(`[settings] 닉네임 저장 실패 (${error.code ?? "?"}): ${error.message}`);
    return { error: saveErrorMessage(error.code) };
  }
  if (!data) {
    return { error: "저장된 줄이 없어요. 로그인을 다시 해보고, 그래도 안 되면 알려주세요." };
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

  // update 가 아니라 upsert 예요. profiles 행이 없는 계정이면 update 는 **아무 행도
  // 못 찾고 조용히 성공**해서, 화면엔 "저장했어요" 가 뜨는데 실제론 아무것도
  // 안 바뀌어요. 그리고 .select() 로 진짜 써졌는지 확인해요.
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        age_band: parsed.data.ageBand || null,
        gender: parsed.data.gender || null,
        drink_scenes: parsed.data.scenes,
        likes_note: parsed.data.likes || null,
        avoids_note: parsed.data.avoids || null,
      },
      { onConflict: "id" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(`[settings] 내 정보 저장 실패 (${error.code ?? "?"}): ${error.message}`);
    return { error: saveErrorMessage(error.code) };
  }
  if (!data) {
    return { error: "저장된 줄이 없어요. 로그인을 다시 해보고, 그래도 안 되면 알려주세요." };
  }

  revalidatePath("/settings");
  revalidatePath("/recommend");
  return { message: "저장했어요. 다음 추천부터 반영돼요." };
}
