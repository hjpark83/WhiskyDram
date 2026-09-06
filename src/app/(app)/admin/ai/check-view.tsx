"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleX, Info, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CheckId, CheckMeta, CheckResult } from "@/lib/ai/self-check";
import { runCheck } from "./actions";

type Row = { meta: CheckMeta; state: "idle" | "running" | "done"; result?: CheckResult; error?: string };

export function CheckView({ checks, canRun }: { checks: CheckMeta[]; canRun: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => checks.map((meta) => ({ meta, state: "idle" })));
  const [pending, startTransition] = useTransition();

  function patch(id: CheckId, next: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.meta.id === id ? { ...r, ...next } : r)));
  }

  function runAll() {
    startTransition(async () => {
      setRows(checks.map((meta) => ({ meta, state: "idle" })));
      // 하나씩 순서대로 — 몰아치면 요청 한도에 걸려서 키 문제로 착각하게 돼요.
      for (const meta of checks) {
        patch(meta.id, { state: "running", result: undefined, error: undefined });
        const outcome = await runCheck(meta.id);
        if ("error" in outcome) patch(meta.id, { state: "done", error: outcome.error });
        else patch(meta.id, { state: "done", result: outcome });
      }
    });
  }

  const done = rows.filter((r) => r.state === "done");
  const failed = done.filter((r) => r.error || r.result?.ok === false).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runAll} disabled={pending || !canRun}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {pending ? "점검하는 중…" : "전체 점검하기"}
        </Button>
        {!canRun && <span className="text-sm text-muted-foreground">키가 없어서 점검할 수 없어요.</span>}
        {!pending && done.length === checks.length && (
          <span className={failed === 0 ? "text-sm text-amber-200" : "text-sm text-red-300"}>
            {failed === 0 ? "전부 통과했어요 ✨" : `${failed}개 실패했어요`}
          </span>
        )}
      </div>

      <ul className="space-y-2.5">
        {rows.map(({ meta, state, result, error }) => {
          const ok = result?.ok === true;
          const bad = Boolean(error) || result?.ok === false;
          return (
            <li key={meta.id}>
              <Card
                className={
                  bad
                    ? "border-red-500/40 bg-red-500/5"
                    : ok
                      ? "border-amber-400/40"
                      : undefined
                }
              >
                <CardContent className="flex gap-3 p-4">
                  <span className="mt-0.5 shrink-0" aria-hidden>
                    {state === "running" ? (
                      <Loader2 className="size-4 animate-spin text-amber-300" />
                    ) : bad ? (
                      <CircleX className="size-4 text-red-400" />
                    ) : ok ? (
                      <CircleCheck className="size-4 text-amber-400" />
                    ) : (
                      <span className="block size-4 rounded-full border border-amber-400/25" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="text-amber-100">{meta.name}</span>
                      {result && (
                        <span className="text-xs tabular-nums text-muted-foreground">{(result.ms / 1000).toFixed(1)}초</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{meta.what}</p>
                    {state === "running" && <p className="text-sm text-amber-50/70">부르고 있어요…</p>}
                    {error && <p className="text-sm text-red-200">{error}</p>}
                    {result && <p className="break-words text-sm text-amber-50/85">{result.detail}</p>}
                    {result?.hint && (
                      <p className="flex gap-1.5 text-xs text-amber-100/70">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>{result.hint}</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
