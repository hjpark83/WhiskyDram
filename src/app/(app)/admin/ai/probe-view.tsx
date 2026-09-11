"use client";

import { useActionState } from "react";
import { CircleCheck, CircleX, Loader2, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProbeReport } from "@/lib/ai/probe";
import { runProbe } from "./actions";

/**
 * "한도인가, 기능이 안 되는 건가" 진단 화면.
 *
 * 자기점검 위에 따로 둬요 — 자기점검이 전부 실패했을 때 **먼저 눌러야 할 것**이
 * 이거예요. 기능이 왜 실패했는지를 가려주니까요.
 */
export function ProbeView() {
  const [state, action, pending] = useActionState<ProbeReport | { error: string } | null, FormData>(
    async () => runProbe(),
    null,
  );
  const report = state && !("error" in state) ? state : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-amber-100">
              <Stethoscope className="size-4 text-amber-400" aria-hidden />
              <h2 className="text-lg">한도인가, 기능이 안 되는 건가</h2>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              같은 키로 최소 호출을 <strong>웹 검색 없이</strong> 한 번,{" "}
              <strong>웹 검색을 붙여</strong> 한 번 날려요. 둘 다 실패하면 계정 한도고, 일반 호출만
              되면 한도가 아니라 검색 기능 쪽 문제예요. 아래 자기점검이 전부 실패했을 때 이걸 먼저
              눌러보세요.
            </p>
          </div>
          <form action={action}>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Stethoscope className="size-4" aria-hidden />
              )}
              {pending ? "확인 중…" : "진단 돌리기"}
            </Button>
          </form>
        </div>

        {state && "error" in state && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        {report && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {report.provider} · {report.model}
              </Badge>
            </div>

            <ul className="space-y-2">
              {report.rows.map((row) => (
                <li key={row.name} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.ok ? (
                      <CircleCheck className="size-4 shrink-0 text-emerald-400" aria-hidden />
                    ) : (
                      <CircleX className="size-4 shrink-0 text-red-400" aria-hidden />
                    )}
                    <span className="text-sm font-medium text-amber-50">{row.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {row.status ?? "네트워크 실패"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{row.ms}ms</span>
                  </div>
                  {/* 원시 본문을 그대로 보여줘요 — 가공하면 진단이 안 돼요 */}
                  <p className="mt-1.5 break-all text-xs leading-relaxed text-muted-foreground">
                    {row.body}
                  </p>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 text-sm">
              <p className="font-semibold text-amber-100">{report.verdict}</p>
              <p className="mt-1 leading-relaxed text-amber-50/85">{report.advice}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
