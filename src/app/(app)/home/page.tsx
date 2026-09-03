import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Compass, NotebookPen, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TasteBars } from "@/components/whisky/taste-bars";
import { getWhiskies, WHISKIES } from "@/data/whiskies";
import type { RecommendationPayload } from "@/lib/ai/recommend";
import { createClient } from "@/lib/supabase/server";
import { hasProfile } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";

const actions = [
  {
    href: "/quiz",
    icon: Compass,
    title: "취향 진단하기",
    body: "1분이면 끝나요. 내 첫 위스키 3병을 추천받으세요.",
    ready: true,
  },
  {
    href: "/whisky",
    icon: Search,
    title: "위스키 탐색",
    body: `국내에서 구할 수 있는 ${WHISKIES.length}병을 쉬운 말로. 내 취향과 맞는 정도도 함께.`,
    ready: true,
  },
  {
    href: "/scan",
    icon: Camera,
    title: "병 사진 찍기",
    body: "마트나 바에서 보이는 그 병, 지금 내 취향에 맞을까요?",
    ready: false,
  },
  {
    href: "/journal",
    icon: NotebookPen,
    title: "마신 후기 남기기",
    body: "한 줄만 남겨도 취향 프로필이 갱신되고 다음 3병이 달라져요.",
    ready: true,
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRow }, { data: rec }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, taste_profile")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("recommendations")
      .select("payload, whisky_ids, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stored = (profileRow?.taste_profile as Partial<TasteProfile> | null) ?? null;
  const profile: TasteProfile | null = hasProfile(stored)
    ? { ...EMPTY_TASTE_PROFILE, ...stored }
    : null;
  const payload = (rec?.payload as RecommendationPayload | undefined) ?? null;
  const picks = rec ? getWhiskies(rec.whisky_ids as string[]) : [];
  const name = profileRow?.display_name ?? user.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">
          {name ? `${name}님, ` : ""}오늘은 어떤 잔을 찾아볼까요?
        </h1>
        <p className="mt-1 text-muted-foreground">
          {profile
            ? "취향 프로필이 준비돼 있어요. 탐색 카드마다 나와 맞는 정도가 보여요."
            : "아직 취향 프로필이 없어요. 진단부터 시작해보세요."}
        </p>
      </section>

      {profile && payload && (
        <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardContent className="space-y-3 p-5">
              <Badge variant="secondary">
                <Sparkles data-icon="inline-start" />
                내 취향
              </Badge>
              <p className="text-xl font-bold">
                당신은 <span className="text-amber-700">{payload.tasteTitle}</span>
              </p>
              <TasteBars profile={profile} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <p className="text-sm font-medium text-muted-foreground">최근 추천받은 3병</p>
              <ul className="space-y-2">
                {picks.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/whisky/${w.id}`}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-amber-600/60"
                    >
                      <span className="font-medium">{w.nameKo}</span>
                      <span className="text-xs text-muted-foreground">{w.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex gap-2 pt-1">
                <Button size="sm" render={<Link href="/recommend" />}>
                  추천 이유 다시 보기
                </Button>
                <Button size="sm" variant="ghost" render={<Link href="/quiz" />}>
                  다시 진단
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {actions.map(({ href, icon: Icon, title, body, ready }) =>
          ready ? (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-colors group-hover:border-amber-600/60">
                <CardContent className="space-y-3 p-6">
                  <Icon className="size-6 text-amber-700" aria-hidden />
                  <h2 className="font-semibold">{title}</h2>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Card key={href} className="h-full opacity-70">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <Icon className="size-6 text-muted-foreground" aria-hidden />
                  <Badge variant="outline">곧 열려요</Badge>
                </div>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ),
        )}
      </section>
    </div>
  );
}
