import type { Metadata } from "next";
import Link from "next/link";
import { Info, Search, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STORE_LABELS_KO, STORES } from "@/data/stores";
import { getWhisky, WHISKIES } from "@/data/whiskies";
import { listReports } from "@/lib/price/store";
import { agoText, formatKrw, isFresh, stanceFor, STANCE_LABELS_KO, summarizeAll } from "@/lib/price/stats";
import { formatPriceRange } from "@/lib/whisky/format";

export const metadata: Metadata = { title: "위스키 시세" };

export default async function PricePage() {
  const reports = await listReports({ limit: 1000 });
  const summaries = summarizeAll(reports);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl text-amber-100">위스키 시세</h1>
        <p className="text-sm leading-relaxed text-amber-50/85">
          트레이더스·코스트코·조양마트에서 <strong>실제로 본 가격</strong>을 서로 알려주는 곳이에요. 용량이
          달라도 비교할 수 있게 700ml 기준으로 환산해서 보여줘요.
        </p>
      </header>

      <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <div className="space-y-1 text-amber-50/85">
          <p>
            <strong className="font-semibold">왜 제보로 모으나요?</strong> 한국은 주류 통신판매가 원칙적으로
            금지라 마트가 위스키 가격을 웹에 올리지 않아요. 긁어올 원본이 아예 없어서, 애호가들이 서로
            알려주는 방식이 유일해요.
          </p>
          <p className="text-xs text-muted-foreground">
            그래서 제보 수와 <strong>언제 본 가격인지</strong>를 항상 같이 보여줘요. 오래된 제보는 흐리게
            표시돼요.
          </p>
        </div>
      </div>

      {summaries.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <TrendingDown className="mx-auto size-8 text-amber-400/60" aria-hidden />
            <p className="text-amber-100">아직 제보가 없어요</p>
            <p className="text-sm text-muted-foreground">
              첫 제보를 남겨주시면 다른 분들에게 바로 도움이 돼요. 위스키를 골라 시세를 남겨보세요.
            </p>
            <Button size="sm" variant="outline" render={<Link href="/whisky" />}>
              <Search className="size-4" aria-hidden /> 위스키 찾아보기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl text-amber-100">제보된 시세</h2>
            <span className="text-xs text-muted-foreground">
              {summaries.length}병 · 제보 {reports.length}건
            </span>
          </div>
          <ul className="space-y-2">
            {summaries.map((s) => {
              const whisky = getWhisky(s.whiskyId);
              if (!whisky) return null;
              const stance = stanceFor(s.medianPer700, whisky.priceKrw);
              const fresh = isFresh(s.latestSeenOn);
              return (
                <li key={s.whiskyId}>
                  <Link
                    href={`/price/${s.whiskyId}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/15 bg-amber-500/5 px-4 py-3 transition-colors hover:border-amber-400/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-amber-50">{whisky.nameKo}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        사전 시세 {formatPriceRange(whisky.priceKrw)} · 제보 {s.count}건 ·{" "}
                        <span className={fresh ? undefined : "opacity-60"}>
                          최근 {agoText(s.latestSeenOn)}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={stance === "good" ? "default" : "secondary"}
                        className="text-[11px]"
                      >
                        {STANCE_LABELS_KO[stance]}
                      </Badge>
                      <span className={`text-lg tabular-nums ${fresh ? "text-amber-200" : "text-amber-200/60"}`}>
                        {formatKrw(s.medianPer700)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl text-amber-100">제보를 받는 매장</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {STORES.filter((s) => s.hint).map((s) => (
            <li key={s.id} className="rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2">
              <p className="text-sm text-amber-50">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          그 외에도 {STORES.filter((s) => !s.hint).map((s) => STORE_LABELS_KO[s.id]).join(" · ")} 을 고를 수 있어요.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        사전에 있는 위스키 {WHISKIES.length}병 아무거나 시세를 남길 수 있어요. 위스키 상세 화면에서
        &ldquo;시세 보기&rdquo;를 누르면 바로 갈 수 있어요.
      </p>
    </div>
  );
}
