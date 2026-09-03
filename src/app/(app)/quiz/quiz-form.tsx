"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WhiskyGlass } from "@/components/whisky/whisky-glass";
import { cn } from "@/lib/utils";
import { QUIZ_QUESTIONS, type QuizAnswers } from "@/data/quiz";
import { WHISKIES } from "@/data/whiskies";
import { submitQuiz } from "./actions";

const LOADING_LINES = [
  "답변을 취향 프로필로 바꾸는 중…",
  `${WHISKIES.length}병 중에서 후보를 고르는 중…`,
  "AI 소믈리에가 추천 이유를 쓰는 중…",
];

export function QuizForm({ initialAnswers }: { initialAnswers?: QuizAnswers }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(initialAnswers ?? {});
  const [pending, startTransition] = useTransition();
  const [loadingIdx, setLoadingIdx] = useState(0);

  const total = QUIZ_QUESTIONS.length;
  const q = QUIZ_QUESTIONS[step];
  const selected = answers[q.id];
  const isLast = step === total - 1;
  const allAnswered = QUIZ_QUESTIONS.every((qq) => answers[qq.id]);

  function choose(optionId: string) {
    setAnswers((prev) => ({ ...prev, [q.id]: optionId }));
    // 마지막 질문이 아니면 살짝 텀을 두고 자동으로 다음으로.
    if (!isLast) {
      window.setTimeout(() => setStep((s) => Math.min(total - 1, s + 1)), 220);
    }
  }

  function submit() {
    if (!allAnswered) {
      toast.error("아직 답하지 않은 질문이 있어요.");
      return;
    }
    setLoadingIdx(0);
    const timer = window.setInterval(
      () => setLoadingIdx((i) => Math.min(LOADING_LINES.length - 1, i + 1)),
      2500,
    );
    startTransition(async () => {
      try {
        const result = await submitQuiz(answers);
        if (result?.error) toast.error(result.error);
      } finally {
        window.clearInterval(timer);
      }
    });
  }

  if (pending) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <WhiskyGlass size={150} />
        <p className="text-lg font-semibold">{LOADING_LINES[loadingIdx]}</p>
        <p className="text-sm text-muted-foreground">보통 10초 안에 끝나요.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {step + 1} / {total}
          </span>
          <span>{Math.round(((step + 1) / total) * 100)}%</span>
        </div>
        <Progress value={((step + 1) / total) * 100} />
      </div>

      <section key={q.id} className="space-y-2">
        <h1 className="text-2xl font-bold leading-snug">{q.question}</h1>
        {q.hint && <p className="text-sm text-muted-foreground">{q.hint}</p>}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {q.options.map((opt) => {
          const active = selected === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => choose(opt.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all",
                  "hover:border-amber-400/60 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-amber-400 bg-amber-500/10 shadow-sm"
                    : "border-border bg-card",
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {opt.emoji}
                </span>
                <span className="font-medium leading-snug">{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft data-icon="inline-start" />
          이전
        </Button>
        {isLast ? (
          <Button type="button" size="lg" onClick={submit} disabled={!allAnswered}>
            <Sparkles data-icon="inline-start" />
            내 첫 위스키 3병 보기
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            disabled={!selected}
          >
            다음
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}
