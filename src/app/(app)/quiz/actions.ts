"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { QUIZ_QUESTIONS, SCENE_FROM_ANSWER, type QuizAnswers } from "@/data/quiz";
import { personaFromRow, PERSONA_COLUMNS } from "@/lib/ai/persona";
import { generateQuizRecommendation } from "@/lib/ai/recommend";
import { createClient } from "@/lib/supabase/server";
import {
  filtersFromAnswers,
  profileFromAnswers,
  rankWhiskies,
} from "@/lib/whisky/recommend";

const answersSchema = z.object(
  Object.fromEntries(
    QUIZ_QUESTIONS.map((q) => [
      q.id,
      z.enum(q.options.map((o) => o.id) as [string, ...string[]]),
    ]),
  ),
);

export type SubmitQuizResult = { error: string } | { ok: true };

export async function submitQuiz(raw: QuizAnswers): Promise<SubmitQuizResult> {
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "답하지 않은 질문이 있어요. 모든 질문에 답해주세요." };
  }
  const answers = parsed.data as QuizAnswers;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/quiz");

  const profile = profileFromAnswers(answers);
  const filters = filtersFromAnswers(answers);
  const candidates = rankWhiskies(profile, filters, 8);

  // 내 정보를 함께 넘겨요 (칸이 아직 없으면 조용히 건너뛰어요)
  const { data: personaRow } = await supabase
    .from("profiles")
    .select(PERSONA_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();
  const persona = personaFromRow(personaRow as Record<string, unknown> | null);

  const payload = await generateQuizRecommendation({ profile, answers, candidates, persona });

  // 진단에서 고른 "어떤 자리" 는 내 정보의 마시는 상황과 같은 것이라 이어줘요.
  // 이미 내 정보에 적어둔 게 있으면 덮어쓰지 않아요 — 직접 고른 쪽이 우선이에요.
  const sceneFromQuiz = SCENE_FROM_ANSWER[answers.scene ?? ""];
  const scenes = persona.scenes.length > 0 ? persona.scenes : sceneFromQuiz ? [sceneFromQuiz] : [];

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      taste_profile: profile,
      quiz_answers: answers,
      ...(scenes.length > 0 ? { drink_scenes: scenes } : {}),
    },
    { onConflict: "id" },
  );
  if (profileError) {
    console.error("[quiz] profile upsert failed", profileError);
    return { error: "취향 프로필을 저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  const { error: recError } = await supabase.from("recommendations").insert({
    user_id: user.id,
    source: "quiz",
    whisky_ids: payload.picks.map((p) => p.whiskyId),
    payload,
  });
  if (recError) {
    console.error("[quiz] recommendation insert failed", recError);
    return { error: "추천 결과를 저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  return { ok: true };
}
