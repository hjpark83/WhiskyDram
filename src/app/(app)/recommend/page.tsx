import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, GlassWater, NotebookPen, RefreshCw, Sparkles, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlavorBars, TasteBars } from "@/components/whisky/taste-bars";
import { MatchBadge } from "@/components/whisky/whisky-card";
import { getWhisky } from "@/data/whiskies";
import type { RecommendationPayload } from "@/lib/ai/recommend";
import { createClient } from "@/lib/supabase/server";
import {
  DIFFICULTY_LABELS_KO,
  formatAge,
  formatOrigin,
  formatPriceRange,
  TYPE_LABELS_KO,
} from "@/lib/whisky/format";
import { matchPercent } from "@/lib/whisky/recommend";
import { AXIS_LABELS_KO, EMPTY_TASTE_PROFILE, TASTE_AXES, type TasteProfile } from "@/lib/whisky/types";

export const metadata: Metadata = { title: "내 추천" };

const PICK_LABELS = ["첫 번째 추천", "두 번째 추천", "세 번째 추천"];

export default async function RecommendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/recommend");

  const [{ data: rec }, { data: profileRow }] = await Promise.all([
    supabase
      .from("recommendations")
      .select("id, source, payload, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("taste_profile").eq("id", user.id).maybeSingle(),
  ]);

  if (!rec) redirect("/quiz");

  const payload = rec.payload as RecommendationPayload;
  const profile: TasteProfile = {
    ...EMPTY_TASTE_PROFILE,
    ...((profileRow?.taste_profile as Partial<TasteProfile> | null) ?? {}),
  };
  const createdAt = new Date(rec.created_at).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });

  const basis = payload.basedOn;
  const basisWhisky = basis ? getWhisky(basis.whiskyId) : null;
  const deltaChips = basis
    ? TASTE_AXES.filter((a) => (basis.deltas[a] ?? 0) !== 0).map((a) => ({
        axis: a,
        d: basis.deltas[a] as number,
      }))
    : [];

  return (
    <div className="space-y-10">
      {basis && basisWhisky && (
        <section className="rounded-xl border border-amber-600/40 bg-amber-50/60 p-5">
          <div className="flex items-start gap-3">
            <NotebookPen className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
            <div className="space-y-2">
              <p className="font-semibold">
                <Link href={`/whisky/${basisWhisky.id}`} className="underline">
                  {basisWhisky.nameKo}
                </Link>{" "}
                후기({"★".repeat(basis.rating)}{"☆".repeat(5 - basis.rating)})를 반영했어요
              </p>
              <p className="text-sm text-muted-foreground">{basis.summary}</p>
              <p className="text-sm leading-relaxed">{basis.explanation}</p>
              {deltaChips.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {deltaChips.map(({ axis, d }) => (
                    <li
                      key={axis}
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (d > 0 ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-800")
                      }
                    >
                      {AXIS_LABELS_KO[axis]} {d > 0 ? `+${d}` : d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Sparkles data-icon="inline-start" />
              {payload.generatedBy === "claude" ? "AI 소믈리에 추천" : "기본 추천"}
            </Badge>
            <span className="text-xs text-muted-foreground">{createdAt} 진단</span>
          </div>
          <h1 className="text-3xl font-bold">
            당신은 <span className="text-amber-700">{payload.tasteTitle}</span>
          </h1>
          <p className="leading-relaxed text-muted-foreground">{payload.tasteSummary}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" render={<Link href="/quiz" />}>
              <RefreshCw data-icon="inline-start" />
              다시 진단하기
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/whisky" />}>
              내 취향으로 전체 탐색
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/journal" />}>
              <NotebookPen data-icon="inline-start" />
              마신 후기 남기기
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">내 취향 프로필</CardTitle>
          </CardHeader>
          <CardContent>
            <TasteBars profile={profile} />
            <p className="mt-3 text-xs text-muted-foreground">
              오른쪽(주황)은 좋아하는 쪽, 왼쪽(회색)은 피하는 쪽이에요.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">내 첫 위스키 3병</h2>
        <ol className="grid gap-4 lg:grid-cols-3">
          {payload.picks.map((pick, i) => {
            const w = getWhisky(pick.whiskyId);
            if (!w) return null;
            return (
              <li key={pick.whiskyId}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-amber-700">{PICK_LABELS[i]}</p>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold leading-snug">
                          <Link href={`/whisky/${w.id}`} className="hover:underline">
                            {w.nameKo}
                          </Link>
                        </h3>
                        <MatchBadge percent={matchPercent(profile, w)} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {w.name} · {TYPE_LABELS_KO[w.type]}
                      </p>
                    </div>

                    <p className="font-semibold">“{pick.headline}”</p>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">가격대</dt>
                      <dd className="font-medium">{formatPriceRange(w.priceKrw)}</dd>
                      <dt className="text-muted-foreground">도수 · 숙성</dt>
                      <dd>
                        {w.abv}% · {formatAge(w.age)}
                      </dd>
                      <dt className="text-muted-foreground">산지</dt>
                      <dd>{formatOrigin(w)}</dd>
                      <dt className="text-muted-foreground">난이도</dt>
                      <dd>{DIFFICULTY_LABELS_KO[w.difficulty]}</dd>
                    </dl>

                    <p className="text-sm leading-relaxed">{pick.reason}</p>

                    <FlavorBars flavor={w.flavor} compact />

                    <ul className="space-y-2 text-sm">
                      <li className="flex gap-2">
                        <GlassWater className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
                        <span>{pick.howToDrink}</span>
                      </li>
                      <li className="flex gap-2">
                        <Utensils className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
                        <span>{pick.pairing}</span>
                      </li>
                      {pick.caution && (
                        <li className="flex gap-2 text-muted-foreground">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>{pick.caution}</span>
                        </li>
                      )}
                    </ul>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-auto"
                      render={<Link href={`/whisky/${w.id}`} />}
                    >
                      자세히 보기
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-xl border bg-amber-50/60 p-5">
        <h2 className="font-semibold">다음 한 걸음</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{payload.nextStep}</p>
      </section>
    </div>
  );
}
