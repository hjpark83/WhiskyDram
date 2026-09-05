"use client";

import { useActionState } from "react";
import { ExternalLink, Search, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESERVATION_LABELS_KO } from "@/data/popups";
import type { PopupDraft } from "@/lib/ai/popup-research";
import { discoverPopups, saveDrafts, type DiscoverState, type SaveDraftsState } from "../../actions";

const CONFIDENCE_LABELS: Record<PopupDraft["confidence"], string> = {
  high: "근거 충분",
  medium: "일부만 확인됨",
  low: "확인 필요",
};

export function DiscoverView({
  suggestedBrands,
  providerLabel,
}: {
  suggestedBrands: string[];
  providerLabel: string | null;
}) {
  const [search, searchAction, searching] = useActionState<DiscoverState, FormData>(discoverPopups, null);
  const [saved, saveAction, saving] = useActionState<SaveDraftsState, FormData>(saveDrafts, null);

  const report = search?.report;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <form action={searchAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brands">브랜드</Label>
              <Input
                id="brands"
                name="brands"
                defaultValue={suggestedBrands.join(", ")}
                placeholder="쉼표로 구분. 비워두면 위스키 팝업 전반을 찾아요."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">지역</Label>
              <Input id="region" name="region" defaultValue="전국" placeholder="예: 서울, 부산" />
            </div>
            <Button type="submit" disabled={searching}>
              <Search className="size-4" aria-hidden />
              {searching ? "검색하는 중… (30초쯤 걸려요)" : "AI로 팝업 찾기"}
            </Button>
            {providerLabel && (
              <p className="text-xs text-muted-foreground">
                {providerLabel}의 웹 검색으로 찾아요. 결과는 초안이라 공개하려면 확인이 필요해요.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {search?.error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {search.error}
        </p>
      )}

      {report && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl text-amber-100">찾은 후보 {report.drafts.length}개</h2>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {report.provider} · {report.model}
            </Badge>
          </div>

          {report.note && <p className="text-sm text-muted-foreground">{report.note}</p>}

          {report.drafts.length > 0 && (
            <form action={saveAction} className="space-y-4">
              <input type="hidden" name="drafts" value={JSON.stringify(report.drafts)} />

              <div className="flex gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
                <p className="text-amber-50/85">
                  AI가 검색해서 정리한 <strong className="font-semibold">초안</strong>이에요. 기간·주소가 틀리면
                  사용자가 헛걸음하니 출처를 눌러 확인해주세요. 저장해도 <strong className="font-semibold">비공개</strong>
                  라서, 목록에서 &ldquo;공개&rdquo;를 눌러야 사용자에게 보여요.
                </p>
              </div>

              <ul className="space-y-3">
                {report.drafts.map((draft, i) => (
                  <li key={`${draft.brand}-${draft.title}-${i}`}>
                    <Card>
                      <CardContent className="space-y-3 p-4">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            name={`pick-${i}`}
                            defaultChecked={draft.confidence !== "low"}
                            className="mt-1 size-4 shrink-0 accent-amber-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary">{draft.brand}</Badge>
                              <Badge
                                variant="outline"
                                className={draft.confidence === "low" ? "border-destructive/60 text-destructive" : ""}
                              >
                                {CONFIDENCE_LABELS[draft.confidence]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {RESERVATION_LABELS_KO[draft.reservation]}
                              </span>
                            </span>
                            <span className="mt-1 block font-medium text-amber-50">{draft.title}</span>
                            {draft.summary && (
                              <span className="block text-sm text-muted-foreground">{draft.summary}</span>
                            )}
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {[draft.city, draft.venue, draft.hours, draft.entry].filter(Boolean).join(" · ") ||
                                "장소·시간 정보 없음"}
                            </span>
                          </span>
                        </label>

                        {draft.verifyNote && (
                          <p className="text-xs text-amber-300">확인할 점: {draft.verifyNote}</p>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`start-${i}`} className="text-xs">
                              시작일
                            </Label>
                            <Input id={`start-${i}`} type="date" name={`start-${i}`} defaultValue={draft.startDate} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`end-${i}`} className="text-xs">
                              종료일
                            </Label>
                            <Input id={`end-${i}`} type="date" name={`end-${i}`} defaultValue={draft.endDate} />
                          </div>
                        </div>
                        {(!draft.startDate || !draft.endDate) && (
                          <p className="text-xs text-destructive">
                            AI가 기간을 확인하지 못했어요. 출처에서 보고 직접 채워주세요.
                          </p>
                        )}

                        {draft.sources.length > 0 && (
                          <ul className="flex flex-wrap gap-2">
                            {draft.sources.map((url) => (
                              <li key={url}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 px-2.5 py-1 text-xs text-amber-200 hover:border-amber-400/60"
                                >
                                  <ExternalLink className="size-3" aria-hidden />
                                  {new URL(url).hostname.replace(/^www\./, "")}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>

              {saved?.error && (
                <p className="text-sm text-destructive" role="alert">
                  {saved.error}
                </p>
              )}
              {saved?.message && (
                <p className="text-sm text-amber-300" role="status">
                  {saved.message}
                </p>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? "저장 중…" : "고른 항목을 비공개 초안으로 저장"}
              </Button>
            </form>
          )}

          {report.sources.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">검색이 본 곳</p>
              <ul className="flex flex-wrap gap-2">
                {report.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-72 items-center gap-1 truncate rounded-full border border-amber-400/20 px-2.5 py-1 text-xs text-muted-foreground hover:border-amber-400/50"
                    >
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
