"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RESERVATION_LABELS_KO, type PopupReservation } from "@/data/popups";
import type { PopupRecord } from "@/lib/popup/store";
import { savePopup, type AdminState } from "../actions";

const RESERVATIONS: PopupReservation[] = ["walkin", "catchtable", "naver", "instagram"];

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export function PopupForm({ initial }: { initial?: PopupRecord | null }) {
  const [state, formAction, pending] = useActionState<AdminState, FormData>(savePopup, null);
  const editing = Boolean(initial);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="브랜드" hint="예: 발베니">
            <Input name="brand" defaultValue={initial?.brand ?? ""} required maxLength={60} />
          </Field>
          <Field label="브랜드 영문" hint="선택">
            <Input name="brandEn" defaultValue={initial?.brandEn ?? ""} maxLength={60} />
          </Field>
          <Field label="제목" className="sm:col-span-2">
            <Input name="title" defaultValue={initial?.title ?? ""} required maxLength={120} />
          </Field>
          <Field label="한 줄 요약" className="sm:col-span-2" hint="목록 카드에 보여요">
            <Input name="summary" defaultValue={initial?.summary ?? ""} maxLength={200} />
          </Field>
          <Field label="어떤 내용인지" className="sm:col-span-2" hint="2~4문장. 위스키를 처음 접하는 사람 기준으로 써주세요">
            <Textarea name="description" defaultValue={initial?.description ?? ""} rows={5} maxLength={2000} />
          </Field>
          <Field label="가서 할 수 있는 것" className="sm:col-span-2" hint="한 줄에 하나씩">
            <Textarea name="highlights" defaultValue={(initial?.highlights ?? []).join("\n")} rows={4} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="장소 이름">
            <Input name="venue" defaultValue={initial?.venue ?? ""} maxLength={120} />
          </Field>
          <Field label="지역" hint="예: 서울">
            <Input name="city" defaultValue={initial?.city ?? ""} maxLength={40} />
          </Field>
          <Field label="주소" className="sm:col-span-2">
            <Input name="address" defaultValue={initial?.address ?? ""} maxLength={200} />
          </Field>
          <Field label="시작일">
            <Input type="date" name="startDate" defaultValue={initial?.startDate ?? ""} required />
          </Field>
          <Field label="종료일">
            <Input type="date" name="endDate" defaultValue={initial?.endDate ?? ""} required />
          </Field>
          <Field label="운영 시간" hint="예: 13:00 – 21:00 (월 휴무)">
            <Input name="hours" defaultValue={initial?.hours ?? ""} maxLength={120} />
          </Field>
          <Field label="입장 · 가격" hint="예: 3만원 · 시음 4종 포함">
            <Input name="entry" defaultValue={initial?.entry ?? ""} maxLength={160} />
          </Field>
          <Field label="예약 방식">
            <select name="reservation" defaultValue={initial?.reservation ?? "walkin"} className={selectClass}>
              {RESERVATIONS.map((r) => (
                <option key={r} value={r}>
                  {RESERVATION_LABELS_KO[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="강조색" hint="카드 위 띠 색">
            <Input type="color" name="accent" defaultValue={initial?.accent ?? "#d9a441"} className="h-9 w-24 p-1" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5">
          <Field
            label="링크"
            hint="한 줄에 하나. `종류 | 표시할 이름 | 주소` 형식이고 종류는 catchtable · naver · instagram · official · map 중 하나예요. 주소만 적어도 돼요."
          >
            <Textarea
              name="links"
              rows={4}
              placeholder={"catchtable | 캐치테이블에서 예약 | https://app.catchtable.co.kr/...\nofficial | 브랜드 공식 | https://..."}
              defaultValue={(initial?.links ?? []).map((l) => `${l.kind} | ${l.label} | ${l.url}`).join("\n")}
            />
          </Field>
          <Field label="관련 위스키 id" hint="쉼표로 구분. 예: balvenie-12-doublewood, balvenie-14-caribbean-cask">
            <Textarea name="whiskyIds" rows={2} defaultValue={(initial?.whiskyIds ?? []).join(", ")} />
          </Field>
          <Field label="태그" hint="쉼표로 구분. 예: 시음, 워크숍">
            <Input name="tags" defaultValue={(initial?.tags ?? []).join(", ")} />
          </Field>
          <Field label="주소 슬러그" hint={editing ? "수정할 수 없어요" : "비워두면 자동으로 만들어요"}>
            <Input name="id" defaultValue={initial?.id ?? ""} readOnly={editing} maxLength={80} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="published"
              defaultChecked={initial ? initial.published : true}
              className="size-4 accent-amber-500"
            />
            사용자에게 공개
          </label>
        </CardContent>
      </Card>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="text-sm text-amber-300" role="status">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : editing ? "수정 저장" : "등록"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/admin/popups" />}>
          목록으로
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
