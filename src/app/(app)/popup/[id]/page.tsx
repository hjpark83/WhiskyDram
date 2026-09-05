import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Info,
  MapPin,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PopupStatusBadge } from "@/components/popup/popup-card";
import { WhiskyCard } from "@/components/whisky/whisky-card";
import { LINK_LABELS_KO, RESERVATION_LABELS_KO } from "@/data/popups";
import { getWhisky } from "@/data/whiskies";
import { formatPeriod, popupStatus, reservationLink, resolveLinks, statusNote } from "@/lib/popup/format";
import { getPopup, listPopups } from "@/lib/popup/store";
import { createClient } from "@/lib/supabase/server";
import { hasProfile, matchPercent } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";

export async function generateMetadata({ params }: PageProps<"/popup/[id]">): Promise<Metadata> {
  const { id } = await params;
  const popup = await getPopup(id);
  return { title: popup ? `${popup.brand} · ${popup.title}` : "팝업 스토어" };
}

export default async function PopupDetailPage({ params }: PageProps<"/popup/[id]">) {
  const { id } = await params;
  const popup = await getPopup(id);
  if (!popup) notFound();

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

  const whiskies = popup.whiskyIds.map((wid) => getWhisky(wid)).filter((w): w is NonNullable<typeof w> => Boolean(w));
  const links = resolveLinks(popup);
  const booking = reservationLink(popup);
  const status = popupStatus(popup);

  // 같은 브랜드 말고 다른 팝업 몇 개
  const others = (await listPopups()).filter((p) => p.id !== popup.id).slice(0, 3);

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" render={<Link href="/popup" />}>
        <ArrowLeft className="size-4" aria-hidden /> 팝업 목록
      </Button>

      <header className="space-y-3">
        <div
          className="h-1.5 w-24 rounded-full"
          style={{ background: `linear-gradient(90deg, ${popup.accent}, ${popup.accent}22)` }}
          aria-hidden
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{popup.brand}</Badge>
          {popup.brandEn && <span className="text-xs text-muted-foreground">{popup.brandEn}</span>}
          <PopupStatusBadge popup={popup} />
          <span className="text-xs text-muted-foreground">{statusNote(popup)}</span>
        </div>
        <h1 className="text-3xl leading-tight text-amber-100 sm:text-4xl">{popup.title}</h1>
        {popup.summary && <p className="text-base leading-relaxed text-amber-50/85">{popup.summary}</p>}
      </header>

      {popup.sample && (
        <div className="flex gap-2.5 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-amber-50/85">
            이 팝업은 화면 확인용 <strong className="font-semibold">예시</strong>예요. 기간·장소·가격은 실제
            발표된 정보가 아니니, 아래 네이버·인스타그램 링크에서 최신 정보를 확인해주세요.
          </p>
        </div>
      )}

      {/* 기본 정보 */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <InfoRow icon={<CalendarDays className="size-4" />} label="기간">
            {formatPeriod(popup)}
          </InfoRow>
          <InfoRow icon={<Clock className="size-4" />} label="운영 시간">
            {popup.hours || "링크에서 확인"}
          </InfoRow>
          <InfoRow icon={<MapPin className="size-4" />} label="장소">
            {popup.venue}
            {popup.address && <span className="block text-xs text-muted-foreground">{popup.address}</span>}
          </InfoRow>
          <InfoRow icon={<Ticket className="size-4" />} label="입장 · 예약">
            {popup.entry || "링크에서 확인"}
            <span className="block text-xs text-muted-foreground">
              {RESERVATION_LABELS_KO[popup.reservation]}
            </span>
          </InfoRow>
        </CardContent>
      </Card>

      {/* 어떤 내용인지 */}
      {(popup.description || popup.highlights.length > 0) && (
        <section className="space-y-4">
          <h2 className="text-xl text-amber-100">어떤 내용이에요?</h2>
          {popup.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-amber-50/85">{popup.description}</p>
          )}
          {popup.highlights.length > 0 && (
            <ul className="space-y-2">
              {popup.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-sm text-amber-50/90">
                  <Check className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 예약 · 외부 링크 */}
      <section className="space-y-3">
        <h2 className="text-xl text-amber-100">예약하고 더 알아보기</h2>
        <p className="text-xs text-muted-foreground">
          캐치테이블·네이버는 공개 API가 없어서 정보를 가져오지 않고 해당 페이지로 이어줘요. 새 창에서 열려요.
        </p>
        <div className="flex flex-wrap gap-2">
          {booking && (
            <Button
              render={
                <a href={booking.url} target="_blank" rel="noopener noreferrer">
                  {booking.label}
                </a>
              }
            />
          )}
          {links.map((l) => (
            <Button
              key={`${l.kind}-${l.url}`}
              variant="outline"
              render={
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label || LINK_LABELS_KO[l.kind]}
                </a>
              }
            />
          ))}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="size-3" aria-hidden /> 외부 사이트로 이동해요
        </p>
      </section>

      {/* 관련 위스키 */}
      {whiskies.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl text-amber-100">여기서 맛볼 수 있는 위스키</h2>
          <p className="text-sm text-muted-foreground">
            {profile
              ? "내 취향 점수와 함께 보여줘요. 가기 전에 어떤 잔을 먼저 마실지 정해보세요."
              : "취향 진단을 하면 나와 얼마나 맞는지도 함께 보여줘요."}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {whiskies.map((w) => (
              <li key={w.id}>
                <WhiskyCard whisky={w} percent={profile ? matchPercent(profile, w) : null} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {status === "ended" && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
          이 팝업은 끝났어요. 같은 브랜드가 또 열 수 있으니 네이버 링크를 저장해두면 편해요.
        </p>
      )}

      {/* 다른 팝업 */}
      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl text-amber-100">다른 팝업도 볼래요?</h2>
          <ul className="space-y-1.5">
            {others.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/popup/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-sm transition-colors hover:border-amber-400/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.brand} · {formatPeriod(p)}
                    </span>
                  </span>
                  <PopupStatusBadge popup={p} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-amber-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="text-sm text-amber-50/90">{children}</div>
      </div>
    </div>
  );
}
