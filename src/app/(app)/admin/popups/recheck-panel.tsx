"use client";

import { useActionState } from "react";
import { ArrowRight, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { checkedAtText } from "@/lib/popup/format";
import type { PendingRecheck } from "@/lib/popup/recheck";
import { applyRecheck, dismissRecheck, recheckOne, type AdminState } from "../actions";

/**
 * 재확인 결과를 보고 적용하는 자리.
 *
 * 제안을 **항목별로** 고르게 한 이유: 재확인이 종료일은 맞게 찾고 장소는 엉뚱하게
 * 잡는 일이 있어요. 전부 적용 / 전부 버리기만 있으면, 맞는 하나를 쓰려고 틀린
 * 것까지 넣거나, 틀린 하나 때문에 맞는 것을 버려야 해요.
 */
export function RecheckPanel({
  popupId,
  pending,
  lastCheckedAt,
  aiReady,
}: {
  popupId: string;
  pending: PendingRecheck | null;
  lastCheckedAt: string | null;
  /** AI 키가 없으면 눌러도 안 되니 미리 알려줘요 */
  aiReady: boolean;
}) {
  const [ran, runAction, running] = useActionState<AdminState, FormData>(recheckOne, null);
  const [applied, applyAction, applying] = useActionState<AdminState, FormData>(applyRecheck, null);
  const checked = checkedAtText(lastCheckedAt);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base text-amber-100">웹에서 다시 확인</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {checked ? `${checked}.` : "아직 재확인한 적이 없어요."} 기간·시간·장소·입장료·예약
              방법만 봐요 (설명글은 표현이 매번 달라져서 제외해요).
            </p>
          </div>
          <form action={runAction}>
            <input type="hidden" name="id" value={popupId} />
            <Button type="submit" size="sm" variant="outline" disabled={running || !aiReady}>
              <RefreshCw className={running ? "size-4 animate-spin" : "size-4"} aria-hidden />
              {running ? "확인 중… (30초쯤)" : "지금 재확인"}
            </Button>
          </form>
        </div>

        {!aiReady && (
          <p className="text-xs text-amber-300">
            AI 키가 없어서 재확인을 할 수 없어요. 환경변수에 키를 넣어주세요.
          </p>
        )}
        {ran?.error && (
          <p className="text-sm text-destructive" role="alert">
            {ran.error}
          </p>
        )}
        {ran?.message && (
          <p className="text-sm text-amber-300" role="status">
            {ran.message}
          </p>
        )}
        {applied?.error && (
          <p className="text-sm text-destructive" role="alert">
            {applied.error}
          </p>
        )}
        {applied?.message && (
          <p className="text-sm text-amber-300" role="status">
            {applied.message}
          </p>
        )}

        {pending && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {pending.provider} · {pending.model}
              </Badge>
              <Badge
                variant="outline"
                className={pending.confidence === "low" ? "border-destructive/60 text-destructive" : ""}
              >
                확신도 {pending.confidence}
              </Badge>
            </div>

            {pending.notFound && (
              <div className="flex gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
                <p className="text-amber-50/85">
                  웹에서 이 행사를 못 찾았어요. <strong className="font-semibold">값은 손대지 않았어요.</strong>{" "}
                  행사가 내려갔을 수도 있고, 검색이 못 찾은 것일 수도 있어요. 출처를 직접 열어보고
                  끝난 행사면 비공개로 돌려주세요.
                </p>
              </div>
            )}

            {pending.ended && (
              <p className="text-sm text-amber-300">웹에서는 이미 끝난 행사로 보여요.</p>
            )}
            {pending.note && <p className="text-sm text-muted-foreground">메모: {pending.note}</p>}

            {pending.changes.length === 0 ? (
              !pending.notFound && <p className="text-sm text-muted-foreground">바뀐 게 없어요.</p>
            ) : (
              <form action={applyAction} className="space-y-3">
                <input type="hidden" name="id" value={popupId} />
                <p className="text-sm text-amber-50/85">
                  바뀐 것 {pending.changes.length}개예요. 맞는 것만 골라서 적용해주세요.
                </p>
                <ul className="space-y-2">
                  {pending.changes.map((c) => (
                    <li key={c.field}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                        <input
                          type="checkbox"
                          name={`pick-${c.field}`}
                          defaultChecked
                          className="mt-1 size-4 shrink-0 accent-amber-500"
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block text-xs text-muted-foreground">{c.label}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground line-through">{c.from || "(없음)"}</span>
                            <ArrowRight className="size-3.5 shrink-0 text-amber-400" aria-hidden />
                            <span className="font-medium text-amber-100">{c.to}</span>
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {pending.sources.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      근거 — 적용 전에 눌러 확인해주세요
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {pending.sources.map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 px-2.5 py-1 text-xs text-amber-200 hover:border-amber-400/60"
                          >
                            <ExternalLink className="size-3" aria-hidden />
                            {hostOf(url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={applying}>
                    {applying ? "적용 중…" : "고른 것 적용"}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    formAction={dismissRecheck}
                    disabled={applying}
                  >
                    제안 버리기
                  </Button>
                </div>
              </form>
            )}

            {pending.changes.length === 0 && (
              <form action={dismissRecheck}>
                <input type="hidden" name="id" value={popupId} />
                <Button type="submit" size="sm" variant="ghost">
                  확인했어요
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 주소가 이상해도 화면이 죽지 않게 */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}
