"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getWhisky } from "@/data/whiskies";
import { generateJournalRecommendation, noteWeight, type NoteHistoryItem } from "@/lib/ai/journal";
import { createClient } from "@/lib/supabase/server";
import { applyDeltas, rankWhiskies, ruleDeltasFromNote } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";

const inputSchema = z.object({
  whiskyId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().min(5, "후기를 5자 이상 적어주세요.").max(600),
});

export type SubmitNoteInput = z.infer<typeof inputSchema>;
export type SubmitNoteResult = { error: string } | undefined;

export async function submitTastingNote(raw: SubmitNoteInput): Promise<SubmitNoteResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인해주세요." };
  }
  const { whiskyId, rating, review } = parsed.data;
  const whisky = getWhisky(whiskyId);
  if (!whisky) return { error: "사전에 없는 위스키예요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/journal");

  const [{ data: profileRow }, { data: pastNotes }] = await Promise.all([
    supabase.from("profiles").select("taste_profile").eq("id", user.id).maybeSingle(),
    supabase
      .from("tasting_notes")
      .select("whisky_id, rating, review")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const profileBefore: TasteProfile = {
    ...EMPTY_TASTE_PROFILE,
    ...((profileRow?.taste_profile as Partial<TasteProfile> | null) ?? {}),
  };

  const history: NoteHistoryItem[] = (pastNotes ?? [])
    .map((n) => {
      const w = getWhisky(n.whisky_id);
      return w ? { whisky: w, rating: n.rating ?? 3, review: n.review } : null;
    })
    .filter((x): x is NoteHistoryItem => x !== null);

  // 별점 기반 임시 프로필로 후보를 먼저 뽑고, Claude 가 그 안에서 고르게 해요.
  const provisional = applyDeltas(
    profileBefore,
    ruleDeltasFromNote(whisky, rating),
    noteWeight(history.length),
  );
  const excludeIds = [whiskyId, ...history.map((h) => h.whisky.id)];
  const candidates = rankWhiskies(provisional, { excludeIds, maxDifficulty: 4 }, 8);

  const { payload, profileAfter } = await generateJournalRecommendation({
    whisky,
    rating,
    review,
    profileBefore,
    history,
    candidates,
  });

  const { data: note, error: noteError } = await supabase
    .from("tasting_notes")
    .insert({
      user_id: user.id,
      whisky_id: whiskyId,
      rating,
      review,
      ai_analysis: {
        summary: payload.basedOn?.summary,
        liked: payload.basedOn?.liked,
        disliked: payload.basedOn?.disliked,
        deltas: payload.basedOn?.deltas,
        explanation: payload.basedOn?.explanation,
        generatedBy: payload.generatedBy,
      },
    })
    .select("id")
    .single();
  if (noteError) {
    console.error("[journal] note insert failed", noteError);
    return { error: "후기를 저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
  if (payload.basedOn) payload.basedOn.noteId = note.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, taste_profile: profileAfter }, { onConflict: "id" });
  if (profileError) {
    console.error("[journal] profile update failed", profileError);
    return { error: "취향 프로필을 갱신하지 못했어요." };
  }

  const { error: recError } = await supabase.from("recommendations").insert({
    user_id: user.id,
    source: "review",
    whisky_ids: payload.picks.map((p) => p.whiskyId),
    payload,
  });
  if (recError) {
    console.error("[journal] recommendation insert failed", recError);
    return { error: "추천을 저장하지 못했어요." };
  }

  redirect("/recommend");
}
