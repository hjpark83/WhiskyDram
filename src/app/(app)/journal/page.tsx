import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWhisky, WHISKIES } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { AXIS_LABELS_KO, TASTE_AXES, type TasteProfile } from "@/lib/whisky/types";
import { JournalForm, type WhiskyOption } from "./journal-form";

export const metadata: Metadata = { title: "테이스팅 노트" };

interface NoteAnalysis {
  summary?: string;
  liked?: string[];
  disliked?: string[];
  deltas?: Partial<TasteProfile>;
  explanation?: string;
  generatedBy?: "ai" | "claude" | "fallback";
}

const OPTIONS: WhiskyOption[] = WHISKIES.map((w) => ({
  id: w.id,
  nameKo: w.nameKo,
  name: w.name,
  distillery: w.distillery,
  aliases: w.aliases ?? [],
}));

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const { whisky } = await searchParams;
  const initialWhiskyId = typeof whisky === "string" && getWhisky(whisky) ? whisky : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/journal");

  const { data: notes } = await supabase
    .from("tasting_notes")
    .select("id, whisky_id, rating, review, ai_analysis, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-10">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold">테이스팅 노트</h1>
        <p className="text-muted-foreground">
          마신 위스키의 후기를 남기면 AI가 취향 프로필을 갱신하고 다음 3병을 골라줘요.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 후기</CardTitle>
        </CardHeader>
        <CardContent>
          <JournalForm whiskies={OPTIONS} initialWhiskyId={initialWhiskyId} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          지금까지 마신 위스키 <span className="text-muted-foreground">{notes?.length ?? 0}</span>
        </h2>
        {!notes || notes.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            아직 후기가 없어요. 첫 후기를 남기면 취향이 한 단계 선명해져요.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => {
              const w = getWhisky(n.whisky_id);
              const a = (n.ai_analysis as NoteAnalysis | null) ?? {};
              const deltas = a.deltas ?? {};
              const chips = TASTE_AXES.filter((x) => (deltas[x] ?? 0) !== 0);
              const date = new Date(n.created_at).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              return (
                <li key={n.id}>
                  <Card>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {w ? (
                              <Link href={`/whisky/${w.id}`} className="hover:underline">
                                {w.nameKo}
                              </Link>
                            ) : (
                              n.whisky_id
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{date}</p>
                        </div>
                        <div className="flex" aria-label={`${n.rating ?? 0}점`}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={
                                i <= (n.rating ?? 0)
                                  ? "size-4 fill-amber-500 text-amber-500"
                                  : "size-4 text-muted-foreground/30"
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed">“{n.review}”</p>
                      {(a.summary || chips.length > 0) && (
                        <div className="space-y-2 rounded-lg bg-amber-500/10 p-3 text-sm">
                          {a.summary && (
                            <p className="font-medium text-amber-200">AI 분석: {a.summary}</p>
                          )}
                          {a.explanation && (
                            <p className="text-muted-foreground">{a.explanation}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {(a.liked ?? []).map((t) => (
                              <Badge key={`l-${t}`} className="bg-emerald-500/15 text-emerald-200">
                                👍 {t}
                              </Badge>
                            ))}
                            {(a.disliked ?? []).map((t) => (
                              <Badge key={`d-${t}`} className="bg-stone-600 text-stone-100">
                                👎 {t}
                              </Badge>
                            ))}
                            {chips.map((x) => {
                              const d = deltas[x] as number;
                              return (
                                <Badge key={x} variant="outline">
                                  {AXIS_LABELS_KO[x]} {d > 0 ? `+${d}` : d}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
