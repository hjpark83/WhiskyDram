import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitCompareArrows, Lightbulb, MapPin, NotebookPen, Store, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlavorBars } from "@/components/whisky/taste-bars";
import { LiquidSwatch } from "@/components/whisky/liquid-swatch";
import { GlossaryText } from "@/components/whisky/term";
import { MatchBadge, WhiskyCard } from "@/components/whisky/whisky-card";
import { getWhisky } from "@/data/whiskies";
import { PopupStatusBadge } from "@/components/popup/popup-card";
import { formatPeriod, popupStatus, statusNote } from "@/lib/popup/format";
import { listPopups } from "@/lib/popup/store";
import { createClient } from "@/lib/supabase/server";
import {
  DIFFICULTY_LABELS_KO,
  formatAge,
  formatOrigin,
  formatPriceRange,
  getOrigin,
  ORIGIN_LABELS_KO,
  STYLE_DESCRIPTIONS_KO,
  STYLE_EMOJI,
  STYLE_LABELS_KO,
  TYPE_LABELS_KO,
} from "@/lib/whisky/format";
import { hasProfile, matchPercent, similarByFlavor } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";

export async function generateMetadata({
  params,
}: PageProps<"/whisky/[id]">): Promise<Metadata> {
  const { id } = await params;
  const w = getWhisky(id);
  return { title: w ? w.nameKo : "위스키" };
}

export default async function WhiskyDetailPage({ params }: PageProps<"/whisky/[id]">) {
  const { id } = await params;
  const w = getWhisky(id);
  if (!w) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: TasteProfile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("taste_profile")
      .eq("id", user.id)
      .maybeSingle();
    const stored = (data?.taste_profile as Partial<TasteProfile> | null) ?? null;
    if (hasProfile(stored)) profile = { ...EMPTY_TASTE_PROFILE, ...stored };
  }
  const percent = profile ? matchPercent(profile, w) : null;
  const similar = similarByFlavor(w, 3);

  // 이 병을 맛볼 수 있는, 아직 끝나지 않은 팝업
  const popups = (await listPopups()).filter(
    (p) => p.whiskyIds.includes(w.id) && popupStatus(p) !== "ended",
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/whisky" />}>
          <ArrowLeft data-icon="inline-start" />
          위스키 탐색
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/compare?a=${w.id}`} />}>
            <GitCompareArrows data-icon="inline-start" />
            다른 병과 비교
          </Button>
          <Button size="sm" render={<Link href={`/journal?whisky=${w.id}`} />}>
            <NotebookPen data-icon="inline-start" />
            이 병 후기 남기기
          </Button>
        </div>
      </div>

      {popups.length > 0 && (
        <ul className="space-y-2">
          {popups.map((p) => (
            <li key={p.id}>
              <Link
                href={`/popup/${p.id}`}
                className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/8 p-3 transition-colors hover:border-amber-400/70"
              >
                <Store className="size-4 shrink-0 text-amber-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-amber-100">
                    이 병을 한 잔으로 맛볼 수 있어요 — {p.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.brand} · {formatPeriod(p)} · {p.city} · {statusNote(p)}
                  </span>
                </span>
                <PopupStatusBadge popup={p} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{ORIGIN_LABELS_KO[getOrigin(w)]}</Badge>
          <Badge variant="secondary">{TYPE_LABELS_KO[w.type]}</Badge>
          <Badge variant="outline">{DIFFICULTY_LABELS_KO[w.difficulty]}</Badge>
          {w.styles.map((tag) => (
            <Badge key={tag} className="bg-amber-500/15 text-amber-200">
              {STYLE_EMOJI[tag]} {STYLE_LABELS_KO[tag]}
            </Badge>
          ))}
          <MatchBadge percent={percent} />
        </div>
        <div className="flex items-center gap-3">
          <LiquidSwatch whisky={w} size="lg" />
          <div>
            <h1 className="text-3xl font-bold">{w.nameKo}</h1>
            <p className="text-muted-foreground">{w.name}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">가격대</dt>
            <dd className="font-medium">{formatPriceRange(w.priceKrw)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">도수</dt>
            <dd className="font-medium">{w.abv}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">숙성</dt>
            <dd className="font-medium">{formatAge(w.age)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">산지</dt>
            <dd className="font-medium">{formatOrigin(w)}</dd>
          </div>
        </dl>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">어떤 맛일까요?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="향"><GlossaryText text={w.notes.nose} /></Row>
            <Row label="맛"><GlossaryText text={w.notes.palate} /></Row>
            <Row label="여운"><GlossaryText text={w.notes.finish} /></Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">향미 프로필</CardTitle>
          </CardHeader>
          <CardContent>
            <FlavorBars flavor={w.flavor} />
            {!profile && (
              <p className="mt-3 text-xs text-muted-foreground">
                <Link href="/quiz" className="underline">
                  취향 진단
                </Link>
                을 하면 이 병이 나와 얼마나 맞는지 알려드려요.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {w.styles.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">이 병의 스타일</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {w.styles.map((tag) => (
              <li key={tag} className="rounded-xl border p-4 text-sm">
                <p className="font-semibold">
                  {STYLE_EMOJI[tag]} {STYLE_LABELS_KO[tag]}
                </p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  <GlossaryText text={STYLE_DESCRIPTIONS_KO[tag]} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex gap-3 rounded-xl border bg-amber-500/10 p-5">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />
          <div>
            <h2 className="font-semibold">초보자 팁</h2>
            <p className="mt-1 text-sm leading-relaxed"><GlossaryText text={w.beginnerTip} /></p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl border p-5">
          <Utensils className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />
          <div>
            <h2 className="font-semibold">함께 먹으면 좋은 것</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {w.pairings.map((p) => (
                <li key={p}>
                  <Badge variant="outline">{p}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {w.distillery} 증류소 · {w.country}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">맛이 비슷한 다른 병</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {similar.map((s) => (
            <li key={s.id}>
              <WhiskyCard whisky={s} percent={profile ? matchPercent(profile, s) : null} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-2">
      <dt className="font-medium text-amber-400">{label}</dt>
      <dd className="leading-relaxed">{children}</dd>
    </div>
  );
}
