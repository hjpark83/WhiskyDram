import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Sparkles, Store as StoreIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WhiskyCard } from "@/components/whisky/whisky-card";
import { STORE_LABELS_KO } from "@/data/stores";
import { getWhisky } from "@/data/whiskies";
import { judgePrice } from "@/lib/ai/price";
import { listReports } from "@/lib/price/store";
import {
  agoText,
  formatKrw,
  isFresh,
  per700,
  STANCE_LABELS_KO,
  summarize,
} from "@/lib/price/stats";
import { createClient } from "@/lib/supabase/server";
import { formatPriceRange } from "@/lib/whisky/format";
import { hasProfile, matchPercent, rankWhiskies } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";
import { ReportForm } from "../report-form";

// AI 가격 판정이 붙어서 조금 오래 걸릴 수 있어요
export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<"/price/[id]">): Promise<Metadata> {
  const { id } = await params;
  const whisky = getWhisky(id);
  return { title: whisky ? `${whisky.nameKo} 시세` : "위스키 시세" };
}

export default async function PriceDetailPage({ params }: PageProps<"/price/[id]">) {
  const { id } = await params;
  const whisky = getWhisky(id);
  if (!whisky) notFound();

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

  const reports = await listReports({ whiskyId: id });
  const summary = summarize(id, reports);

  // 제보가 있을 때만 판정해요 (없으면 판정할 숫자가 없어요)
  const verdict = summary
    ? await judgePrice({
        whisky,
        summary,
        profile,
        candidates: rankWhiskies(profile ?? EMPTY_TASTE_PROFILE, {
          excludeIds: [whisky.id],
          maxPriceKrw: Math.round(summary.medianPer700 * 1.15),
        }, 6),
      })
    : null;

  const alternatives = (verdict?.alternatives ?? [])
    .map((a) => ({ whisky: getWhisky(a.whiskyId), why: a.why }))
    .filter((a): a is { whisky: NonNullable<ReturnType<typeof getWhisky>>; why: string } => Boolean(a.whisky));

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" render={<Link href="/price" />}>
        <ArrowLeft className="size-4" aria-hidden /> 시세 목록
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{whisky.distillery}</Badge>
          <span className="text-xs text-muted-foreground">사전 시세 {formatPriceRange(whisky.priceKrw)}</span>
        </div>
        <h1 className="text-3xl text-amber-100">{whisky.nameKo}</h1>
        <Link href={`/whisky/${whisky.id}`} className="text-sm text-amber-300 hover:underline">
          위스키 정보 보기 →
        </Link>
      </header>

      {summary ? (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    제보 중간값 (700ml 기준)
                  </p>
                  <p className="text-3xl tabular-nums text-amber-200">{formatKrw(summary.medianPer700)}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>
                    최저 {formatKrw(summary.minPer700)} · 최고 {formatKrw(summary.maxPer700)}
                  </p>
                  <p>
                    제보 {summary.count}건 (최근 90일 {summary.freshCount}건) · 가장 최근{" "}
                    <span className={isFresh(summary.latestSeenOn) ? "text-amber-200" : undefined}>
                      {agoText(summary.latestSeenOn)}
                    </span>
                  </p>
                </div>
              </div>

              {summary.count <= 2 && (
                <p className="flex gap-1.5 rounded-lg border border-dashed border-amber-400/30 bg-amber-500/5 p-3 text-xs text-amber-50/85">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-300" aria-hidden />
                  제보가 {summary.count}건뿐이라 아직 시세라고 보긴 어려워요. 참고만 해주세요.
                </p>
              )}
            </CardContent>
          </Card>

          {verdict && (
            <Card>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="size-4 text-amber-400" aria-hidden />
                  <h2 className="text-lg text-amber-100">{verdict.headline}</h2>
                  <Badge variant={verdict.stance === "good" ? "default" : "secondary"} className="text-[11px]">
                    {STANCE_LABELS_KO[verdict.stance]}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-amber-50/85">{verdict.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {verdict.generatedBy === "ai"
                    ? `${verdict.provider}가 제보된 숫자를 읽고 판정했어요. 가격은 AI가 만든 게 아니라 제보값이에요.`
                    : "지금은 규칙 기반으로 판정했어요 (사전 시세 범위와 비교)."}
                </p>
              </CardContent>
            </Card>
          )}

          <section className="space-y-3">
            <h2 className="text-xl text-amber-100">매장별</h2>
            <ul className="space-y-1.5">
              {summary.byStore.map((s) => (
                <li
                  key={s.store}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-1.5 text-amber-50">
                    <StoreIcon className="size-3.5 text-amber-400" aria-hidden />
                    {STORE_LABELS_KO[s.store] ?? s.store}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="tabular-nums text-amber-200">{formatKrw(s.medianPer700)}</span> · {s.count}건 ·{" "}
                    {agoText(s.latestSeenOn)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {alternatives.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl text-amber-100">비슷한 값이면 이 병도요</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {alternatives.map((a) => (
                  <li key={a.whisky.id} className="space-y-1.5">
                    <WhiskyCard whisky={a.whisky} percent={profile ? matchPercent(profile, a.whisky) : null} />
                    <p className="px-1 text-xs text-muted-foreground">{a.why}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xl text-amber-100">제보 목록</h2>
            <ul className="space-y-1.5">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/15 px-3 py-2 text-sm ${
                    isFresh(r.seenOn) ? "bg-amber-500/5" : "bg-transparent opacity-60"
                  }`}
                >
                  <span className="min-w-0 text-amber-50/90">
                    {STORE_LABELS_KO[r.store] ?? r.store}
                    {r.storeNote && <span className="text-muted-foreground"> {r.storeNote}</span>}
                    {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    <span className="tabular-nums text-amber-200">{r.priceKrw.toLocaleString("ko-KR")}원</span>
                    {r.volumeMl !== 700 && (
                      <span className="text-xs">
                        {" "}
                        / {r.volumeMl}ml (700ml 환산 {formatKrw(per700(r))})
                      </span>
                    )}
                    <span className="text-xs"> · {agoText(r.seenOn)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <Card>
          <CardContent className="space-y-2 p-6 text-center">
            <p className="text-amber-100">이 병은 아직 제보가 없어요</p>
            <p className="text-sm text-muted-foreground">
              사전에 적힌 국내 시세는 {formatPriceRange(whisky.priceKrw)}예요. 실제로 보신 가격을 남겨주시면
              첫 제보가 돼요.
            </p>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-xl text-amber-100">시세 제보하기</h2>
        <Card>
          <CardContent className="p-5">
            <ReportForm whiskyId={whisky.id} canReport={Boolean(user)} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
