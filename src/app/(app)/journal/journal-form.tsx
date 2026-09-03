"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Sparkles, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitTastingNote } from "./actions";

export interface WhiskyOption {
  id: string;
  nameKo: string;
  name: string;
  distillery: string;
  aliases: string[];
}

const RATING_LABELS = ["", "별로였어요", "그냥 그랬어요", "무난했어요", "좋았어요", "최고였어요"];

const PROMPTS = [
  "첫 향은 어땠나요? (예: 달콤한 냄새, 연기 냄새, 병원 냄새…)",
  "입에서는요? (예: 부드러웠다, 너무 셌다, 과일 맛)",
  "다음에 또 마시고 싶나요? 어떤 점 때문에?",
];

export function JournalForm({
  whiskies,
  initialWhiskyId,
}: {
  whiskies: WhiskyOption[];
  initialWhiskyId?: string;
}) {
  const [query, setQuery] = useState("");
  const [whiskyId, setWhiskyId] = useState<string | null>(initialWhiskyId ?? null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => whiskies.find((w) => w.id === whiskyId) ?? null,
    [whiskies, whiskyId],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return whiskies
      .filter((w) =>
        [w.nameKo, w.name, w.distillery, ...w.aliases].join(" ").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [whiskies, query]);

  const canSubmit = Boolean(whiskyId) && rating > 0 && review.trim().length >= 5;

  function submit() {
    if (!whiskyId || !canSubmit) return;
    startTransition(async () => {
      const result = await submitTastingNote({ whiskyId, rating, review });
      if (result?.error) toast.error(result.error);
    });
  }

  if (pending) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Sparkles className="size-8 animate-pulse text-amber-400" aria-hidden />
        <p className="text-lg font-semibold">후기를 읽고 취향을 다시 계산하는 중…</p>
        <p className="text-sm text-muted-foreground">다음 3병까지 함께 골라요. 보통 10초 안에 끝나요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. 위스키 */}
      <section className="space-y-2">
        <h2 className="font-semibold">1. 어떤 위스키를 마셨나요?</h2>
        {selected ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-400 bg-amber-500/10 px-4 py-3">
            <div>
              <p className="font-semibold">{selected.nameKo}</p>
              <p className="text-xs text-muted-foreground">
                {selected.name} · {selected.distillery}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setWhiskyId(null);
                setQuery("");
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-amber-500/20"
              aria-label="다른 위스키 선택"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름으로 검색 (예: 글렌피딕, 라프로익)"
                className="pl-9"
                autoFocus
              />
            </div>
            {matches.length > 0 && (
              <ul className="divide-y rounded-xl border">
                {matches.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setWhiskyId(w.id)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-amber-500/10"
                    >
                      <span className="font-medium">{w.nameKo}</span>
                      <span className="text-xs text-muted-foreground">{w.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && matches.length === 0 && (
              <p className="text-sm text-muted-foreground">
                사전에 없는 병이에요. 비슷한 이름으로 다시 검색해보세요.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2. 별점 */}
      <section className="space-y-2">
        <h2 className="font-semibold">2. 얼마나 마음에 들었나요?</h2>
        <div className="flex items-center gap-3">
          <div className="flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                aria-label={`${n}점`}
                className="p-1"
              >
                <Star
                  className={cn(
                    "size-8 transition-colors",
                    n <= (hover || rating)
                      ? "fill-amber-500 text-amber-500"
                      : "text-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {RATING_LABELS[hover || rating] || "별을 눌러주세요"}
          </span>
        </div>
      </section>

      {/* 3. 후기 */}
      <section className="space-y-2">
        <h2 className="font-semibold">3. 한 줄만 남겨주세요</h2>
        <Textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={4}
          maxLength={600}
          placeholder="예: 처음엔 연기 냄새가 낯설었는데 뒤에 오는 단맛이 좋았어요. 얼음 넣으니 훨씬 편했어요."
        />
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {PROMPTS.map((p) => (
            <li key={p}>· {p}</li>
          ))}
        </ul>
      </section>

      <Button size="lg" onClick={submit} disabled={!canSubmit} className="w-full sm:w-auto">
        <Sparkles data-icon="inline-start" />
        후기 저장하고 다음 3병 추천받기
      </Button>
    </div>
  );
}
