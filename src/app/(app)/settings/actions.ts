"use server";

import { revalidatePath } from "next/cache";
import { nicknameSchema } from "@/lib/auth/nickname";
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
