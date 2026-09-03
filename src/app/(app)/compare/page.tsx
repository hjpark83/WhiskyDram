import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatchBadge } from "@/components/whisky/whisky-card";
import { LiquidSwatch } from "@/components/whisky/liquid-swatch";
import { getWhisky, WHISKIES } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import {
  DIFFICULTY_LABELS_KO,
  formatAge,
  formatOrigin,
  formatPriceRange,
  STYLE_EMOJI,
  STYLE_LABELS_KO,
  TYPE_LABELS_KO,
} from "@/lib/whisky/format";
import { hasProfile, matchPercent } from "@/lib/whisky/recommend";
import { AXIS_LABELS_KO, EMPTY_TASTE_PROFILE, TASTE_AXES, type TasteProfile, type Whisky } from "@/lib/whisky/types";
import { ComparePicker, type PickerOption } from "./compare-picker";

export const metadata: Metadata = { title: "두 병 비교" };

const OPTIONS: PickerOption[] = WHISKIES.map((w) => ({
  id: w.id,
  nameKo: w.nameKo,
  name: w.name,
  distillery: w.distillery,
  aliases: w.aliases ?? [],
}));

function toOption(w: Whisky | undefined): PickerOption | null {
  return w ? OPTIONS.find((o) => o.id === w.id) ?? null : null;
}

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const { a, b } = await searchParams;
  const wa = typeof a === "string" ? getWhisky(a) : undefined;
  const wb = typeof b === "string" ? getWhisky(b) : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profile: TasteProfile | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("taste_profile").eq("id", user.id).maybeSingle();
    const stored = (data?.taste_profile as Partial<TasteProfile> | null) ?? null;
    if (hasProfile(stored)) profile = { ...EMPTY_TASTE_PROFILE, ...stored };
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">두 병 비교</h1>
        <p className="mt-1 text-muted-foreground">고민되는 두 병을 나란히 놓고 향미, 가격, 도수를 비교해보세요.</p>
      </section>

      <Suspense>
        <div className="grid gap-3 sm:grid-cols-2">
          <ComparePicker slot="a" options={OPTIONS} selected={toOption(wa)} />
          <ComparePicker slot="b" options={OPTIONS} selected={toOption(wb)} />
        </div>
      </Suspense>

      {wa && wb ? (
        <Comparison a={wa} b={wb} profile={profile} />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {wa || wb ? "비교할 다른 병을 검색해서 골라주세요." : "두 병을 검색해서 골라주세요. 예: 글렌피딕 12 vs 글렌리벳 12"}
        </p>
      )}
    </div>
  );
}

function Comparison({ a, b, profile }: { a: Whisky; b: Whisky; profile: TasteProfile | null }) {
  const pa = profile ? matchPercent(profile, a) : null;
  const pb = profile ? matchPercent(profile, b) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {[a, b].map((w, i) => (
          <Card key={w.id} className={i === 0 ? "border-amber-600/50" : "border-sky-600/50"}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <LiquidSwatch whisky={w} size="lg" />
                  <div>
                    <h2 className="text-lg font-bold leading-snug">
                      <Link href={`/whisky/${w.id}`} className="hover:underline">
                        {w.nameKo}
                      </Link>
                    </h2>
                    <p className="text-xs text-muted-foreground">{w.name}</p>
                  </div>
                </div>
                <MatchBadge percent={i === 0 ? pa : pb} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{TYPE_LABELS_KO[w.type]}</Badge>
                <Badge variant="outline">{formatOrigin(w)}</Badge>
                {w.styles.map((t) => (
                  <Badge key={t} className="bg-amber-100 text-amber-900">
                    {STYLE_EMOJI[t]} {STYLE_LABELS_KO[t]}
                  </Badge>
                ))}
              </div>
              <dl className="grid grid-cols-[4rem_1fr] gap-y-1 text-sm">
                <dt className="text-muted-foreground">가격대</dt>
                <dd className="font-medium">{formatPriceRange(w.priceKrw)}</dd>
                <dt className="text-muted-foreground">도수</dt>
                <dd>{w.abv}%</dd>
                <dt className="text-muted-foreground">숙성</dt>
                <dd>{formatAge(w.age)}</dd>
                <dt className="text-muted-foreground">난이도</dt>
                <dd>{DIFFICULTY_LABELS_KO[w.difficulty]}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">향미 비교</h3>
            <div className="flex gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-amber-600" /> {a.nameKo}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-sky-600" /> {b.nameKo}
              </span>
            </div>
          </div>
          <ul className="space-y-3">
            {TASTE_AXES.map((axis) => {
              const va = a.flavor[axis];
              const vb = b.flavor[axis];
              const diff = va - vb;
              return (
                <li key={axis} className="grid grid-cols-[5.5rem_1fr_5rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{AXIS_LABELS_KO[axis]}</span>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-amber-600" style={{ width: `${(va / 5) * 100}%` }} />
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-sky-600" style={{ width: `${(vb / 5) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-right text-xs text-muted-foreground">
                    {diff === 0 ? "비슷해요" : diff > 0 ? `${a.nameKo.split(" ")[0]} +${diff}` : `${b.nameKo.split(" ")[0]} +${-diff}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {[a, b].map((w) => (
          <Card key={w.id}>
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="font-semibold">{w.nameKo}</p>
              <p><span className="text-amber-700">향</span> {w.notes.nose}</p>
              <p><span className="text-amber-700">맛</span> {w.notes.palate}</p>
              <p><span className="text-amber-700">여운</span> {w.notes.finish}</p>
              <p className="text-muted-foreground">{w.beginnerTip}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" render={<Link href={`/compare?a=${b.id}`} />}>
          {b.nameKo}와 다른 병 비교
        </Button>
        <Button variant="ghost" size="sm" render={<Link href="/whisky" />}>
          위스키 탐색으로
        </Button>
      </div>
    </div>
  );
}
