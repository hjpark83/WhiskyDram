import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BottleArt } from "@/components/whisky/bottle-art";
import { cn } from "@/lib/utils";
import {
  DIFFICULTY_LABELS_KO,
  formatOrigin,
  formatPriceRange,
  STYLE_EMOJI,
  STYLE_LABELS_KO,
  TYPE_SHORT_KO,
} from "@/lib/whisky/format";
import type { Whisky } from "@/lib/whisky/types";

export function MatchBadge({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const tone =
    percent >= 75
      ? "bg-amber-500 text-amber-950"
      : percent >= 55
        ? "bg-amber-500/15 text-amber-200"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", tone)}>
      취향 {percent}%
    </span>
  );
}

export function WhiskyCard({
  whisky,
  percent = null,
  className,
}: {
  whisky: Whisky;
  percent?: number | null;
  className?: string;
}) {
  return (
    <Link href={`/whisky/${whisky.id}`} className={cn("group block", className)}>
      <Card className="h-full transition-colors group-hover:border-amber-400/60">
        <CardContent className="flex h-full gap-4 p-5">
          {/* 병 그림 — 계산한 액체 색과 종류별 실루엣이라 목록에서 구분이 돼요 */}
          <div className="h-24 w-10 shrink-0 self-start transition-transform duration-300 group-hover:scale-105">
            <BottleArt whisky={whisky} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{whisky.nameKo}</h3>
              <p className="truncate text-xs text-muted-foreground">{whisky.name}</p>
            </div>
            <MatchBadge percent={percent} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{TYPE_SHORT_KO[whisky.type]}</Badge>
            <Badge variant="outline">{formatOrigin(whisky)}</Badge>
            <Badge variant="outline">{DIFFICULTY_LABELS_KO[whisky.difficulty]}</Badge>
            {whisky.styles.map((tag) => (
              <Badge key={tag} className="bg-amber-500/15 text-amber-200">
                {STYLE_EMOJI[tag]} {STYLE_LABELS_KO[tag]}
              </Badge>
            ))}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{whisky.notes.nose}</p>
          <p className="mt-auto text-sm font-medium">{formatPriceRange(whisky.priceKrw)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
