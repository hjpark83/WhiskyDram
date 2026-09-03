import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { QuizAnswers } from "@/data/quiz";
import { QuizForm } from "./quiz-form";

export const metadata: Metadata = { title: "취향 진단" };

export default async function QuizPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialAnswers: QuizAnswers | undefined;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("quiz_answers")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.quiz_answers && typeof data.quiz_answers === "object") {
      initialAnswers = data.quiz_answers as QuizAnswers;
    }
  }

  return <QuizForm initialAnswers={initialAnswers} />;
}
