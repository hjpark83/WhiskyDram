import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RESERVATION_LABELS_KO, type PopupStore } from "@/data/popups";
import { formatPeriod, popupStatus, statusNote, STATUS_LABELS_KO } from "@/lib/popup/format";
import { cn } from "@/lib/utils";

export function PopupStatusBadge({
  popup,
  className,
}: {
  popup: Pick<PopupStore, "startDate" | "endDate">;
  className?: string;
}) {
  const status = popupStatus(popup);
  const tone =
    status === "ongoing"
      ? "bg-amber-500 text-amber-950"
      : status === "upcoming"
        ? "bg-amber-500/15 text-amber-200"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", tone, className)}>
      {STATUS_LABELS_KO[status]}
    </span>
  );
}

export function PopupCard({ popup }: { popup: PopupStore }) {
  const status = popupStatus(popup);

  return (
    <Link href={`/popup/${popup.id}`} className="group block">
      <Card className={cn("h-full overflow-hidden transition-colors group-hover:border-amber-400/60", status === "ended" && "opacity-70")}>
        {/* 대표 사진. 없거나 못 불러오면 뒤에 깔린 브랜드 색이 그대로 보여요. */}
        {popup.imageUrl ? (
          <div
            className="relative aspect-[16/9] w-full overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${popup.accent}, ${popup.accent}22)` }}
          >
            {/* 관리자가 넣는 임의의 주소라 next/image 최적화를 안 거쳐요 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={popup.imageUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />
          </div>
        ) : (
          <div
            className="h-1.5 w-full"
            style={{ background: `linear-gradient(90deg, ${popup.accent}, ${popup.accent}22)` }}
            aria-hidden
          />
        )}
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-amber-300">
                {popup.brand}
              </p>
              <h3 className="mt-0.5 text-lg leading-snug text-amber-50">{popup.title}</h3>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <PopupStatusBadge popup={popup} />
              <span className="text-[11px] text-muted-foreground">{statusNote(popup)}</span>
            </div>
          </div>

          {popup.summary && <p className="text-sm leading-relaxed text-amber-50/80">{popup.summary}</p>}

          <dl className="mt-auto space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">기간</dt>
              <dd>{formatPeriod(popup)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">장소</dt>
              <dd className="truncate">
                {popup.city}
                {popup.venue ? ` · ${popup.venue}` : ""}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Ticket className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">입장</dt>
              <dd className="truncate">
                {popup.entry || RESERVATION_LABELS_KO[popup.reservation]}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-1.5">
            {popup.sample && (
              <Badge variant="outline" className="border-dashed text-[11px] text-muted-foreground">
                예시 데이터
              </Badge>
            )}
            {popup.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[11px]">
                {t}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
