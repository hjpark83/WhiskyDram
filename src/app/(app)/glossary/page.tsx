import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { GLOSSARY, type GlossaryEntry } from "@/data/glossary";

export const metadata: Metadata = { title: "용어 사전" };

const CATEGORIES: GlossaryEntry["category"][] = ["맛과 향", "숙성과 통", "만드는 법", "마시는 법", "라벨 읽기"];

export default function GlossaryPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">용어 사전</h1>
        <p className="mt-1 text-muted-foreground">
          위스키 이야기에 자주 나오는 말을 쉬운 말로 풀었어요. 본문에서 점선 밑줄이 있는 단어를 누르면 바로 볼 수 있어요.
        </p>
      </section>

      <nav className="flex flex-wrap gap-1.5 text-sm">
        {CATEGORIES.map((c) => (
          <a key={c} href={`#cat-${c}`} className="rounded-full border px-3 py-1 hover:border-amber-600/60">
            {c}
          </a>
        ))}
      </nav>

      {CATEGORIES.map((c) => (
        <section key={c} id={`cat-${c}`} className="space-y-3 scroll-mt-20">
          <h2 className="text-lg font-bold">{c}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {GLOSSARY.filter((e) => e.category === c).map((e) => (
              <li key={e.id} id={e.id} className="scroll-mt-20">
                <Card className="h-full">
                  <CardContent className="space-y-2 p-5">
                    <p className="font-semibold">
                      {e.emoji} {e.term}
                      {e.aliases.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {e.aliases.slice(0, 2).join(" · ")}
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-medium text-amber-900">{e.short}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{e.long}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
