import type { Metadata } from "next";
import Link from "next/link";
import { Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STORE_LABELS_KO } from "@/data/stores";
import { getWhisky } from "@/data/whiskies";
import { agoText, formatKrw, per700 } from "@/lib/price/stats";
import { listReports } from "@/lib/price/store";
import { removeReport } from "../actions";

export const metadata: Metadata = { title: "시세 제보 관리" };

export default async function AdminPricesPage() {
  const reports = await listReports({ limit: 200 });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl text-amber-100">시세 제보</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          최근 제보 {reports.length}건이에요. 값이 명백히 잘못됐거나 장난 제보는 여기서 지울 수 있어요.
          지우면 그 병의 중간값이 바로 다시 계산돼요.
        </p>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <p className="text-amber-50/85">
          지우기 전에 한 번 생각해주세요. <strong>비싸 보이는 값이 틀린 값은 아니에요</strong> — 면세점·주류
          전문점은 원래 폭이 커요. 용량이 다른 병도 700ml 기준으로 환산해서 보여주니 확인해보세요.
        </p>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            아직 제보가 없어요. <Link href="/price" className="text-amber-300 hover:underline">시세 화면</Link>
            에서 첫 제보를 남겨보세요.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1.5">
          {reports.map((r) => {
            const whisky = getWhisky(r.whiskyId);
            const converted = per700(r);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-amber-50">
                    {whisky?.nameKo ?? `(사전에 없음: ${r.whiskyId})`}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {STORE_LABELS_KO[r.store] ?? r.store}
                    {r.storeNote ? ` ${r.storeNote}` : ""} · {agoText(r.seenOn)}
                    {r.note ? ` · "${r.note}"` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-right">
                    <span className="block tabular-nums text-amber-200">
                      {r.priceKrw.toLocaleString("ko-KR")}원
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {r.volumeMl}ml
                      {r.volumeMl !== 700 ? ` → ${formatKrw(converted)}` : ""}
                    </span>
                  </span>
                  <form action={removeReport}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="whiskyId" value={r.whiskyId} />
                    <Button type="submit" size="sm" variant="ghost" className="text-red-300">
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">지우기</span>
                    </Button>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
