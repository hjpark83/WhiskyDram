"use client";

import { useActionState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STORES, VOLUMES_ML } from "@/data/stores";
import { submitReport, type PriceState } from "./actions";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-amber-400/20 bg-background px-3 text-sm text-amber-50 outline-none focus:border-amber-400/60";

export function ReportForm({ whiskyId, canReport }: { whiskyId: string; canReport: boolean }) {
  const [state, action, pending] = useActionState<PriceState, FormData>(submitReport, null);
  const today = new Date().toISOString().slice(0, 10);

  if (!canReport) {
    return (
      <p className="text-sm text-muted-foreground">
        제보하려면 로그인이 필요해요. 다른 분들이 올린 시세는 로그인 없이도 볼 수 있어요.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="whiskyId" value={whiskyId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="store">어디서 봤어요?</Label>
          <select id="store" name="store" className={SELECT_CLASS} defaultValue="traders" required>
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="storeNote">지점 (선택)</Label>
          <Input id="storeNote" name="storeNote" placeholder="예: 월평점" maxLength={40} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceKrw">가격 (원)</Label>
          <Input
            id="priceKrw"
            name="priceKrw"
            inputMode="numeric"
            placeholder="예: 78000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="volumeMl">용량</Label>
          <select id="volumeMl" name="volumeMl" className={SELECT_CLASS} defaultValue={700}>
            {VOLUMES_ML.map((v) => (
              <option key={v} value={v}>
                {v}ml{v === 700 ? " (가장 흔해요)" : v === 1000 ? " (코스트코에 많아요)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seenOn">언제 봤어요?</Label>
          <Input id="seenOn" name="seenOn" type="date" max={today} defaultValue={today} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">메모 (선택)</Label>
          <Input id="note" name="note" placeholder="예: 1+1 행사였어요" maxLength={200} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        용량이 다르면 가격을 비교할 수 없어서, 화면에서는 <strong>700ml 기준으로 환산</strong>해서 보여줘요.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "올리는 중…" : "시세 제보하기"}
      </Button>

      {state?.error && (
        <p className="flex items-start gap-1.5 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
        </p>
      )}
      {state?.message && (
        <p className="flex items-start gap-1.5 text-sm text-amber-200">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
        </p>
      )}
    </form>
  );
}
