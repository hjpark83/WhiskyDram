import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LiquidSwatch } from "@/components/whisky/liquid-swatch";
import { TasteBars } from "@/components/whisky/taste-bars";
import { getWhiskies } from "@/data/whiskies";
import { decodeShare, encodeShare } from "@/lib/share";
import { formatPriceRange, TYPE_SHORT_KO } from "@/lib/whisky/format";
import { describeProfile } from "@/lib/whisky/recommend";

export async function generateMetadata({ searchParams }: PageProps<"/share">): Promise<Metadata> {
  const data = decodeShare(await searchParams);
  if (!data) return { title: "취향 결과 공유" };
  const title = `나는 "${data.title}" · FirstDram`;
  const description = describeProfile(data.profile).join(" · ");
  const og = `/api/og?${encodeShare(data)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const data = decodeShare(await searchParams);
  const whiskies = data ? getWhiskies(data.whiskyIds) : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-bold">
          🥃 FirstDram
        </Link>
        <Button size="sm" render={<Link href="/quiz" />}>
          나도 진단하기
        </Button>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16">
        {!data ? (
          <p className="rounded-xl border p-8 text-center text-muted-foreground">
            공유 링크가 올바르지 않아요.
          </p>
        ) : (
          <>
            <Card className="overflow-hidden border-amber-600/40">
              <div className="bg-amber-600 px-6 py-5 text-white">
                <p className="flex items-center gap-1.5 text-xs opacity-90">
                  <Sparkles className="size-3.5" /> AI 위스키 취향 진단 결과
                </p>
                <h1 className="mt-1 text-3xl font-bold">나는 “{data.title}”</h1>
              </div>
              <CardContent className="space-y-5 p-6">
                <ul className="flex flex-wrap gap-1.5">
                  {describeProfile(data.profile).map((line) => (
                    <li key={line} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
                      {line}
                    </li>
                  ))}
                </ul>
                <TasteBars profile={data.profile} />
                {whiskies.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">추천받은 첫 위스키</p>
                    <ul className="grid gap-2 sm:grid-cols-3">
                      {whiskies.map((w) => (
                        <li key={w.id} className="rounded-xl border p-3">
                          <div className="flex items-center gap-2">
                            <LiquidSwatch whisky={w} size="sm" />
                            <p className="truncate text-sm font-semibold">{w.nameKo}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {TYPE_SHORT_KO[w.type]} · {formatPriceRange(w.priceKrw)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <section className="space-y-3 text-center">
              <p className="text-muted-foreground">
                커피·디저트·매운맛 취향만 답하면 1분 만에 내 첫 위스키 3병을 골라줘요.
              </p>
              <Button size="lg" render={<Link href="/quiz" />}>
                <Sparkles data-icon="inline-start" />
                나도 1분 취향 진단하기
              </Button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
