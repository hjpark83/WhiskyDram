"use client";

import { useMemo, useState } from "react";
import { PopupCard } from "@/components/popup/popup-card";
import type { PopupStore } from "@/data/popups";
import { popupStatus, sortPopups, type PopupStatus } from "@/lib/popup/format";
import { cn } from "@/lib/utils";

type StatusFilter = PopupStatus | "all";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "ongoing", label: "진행 중" },
  { id: "upcoming", label: "오픈 예정" },
  { id: "ended", label: "종료" },
  { id: "all", label: "전체" },
];

export function PopupExplorer({ popups }: { popups: PopupStore[] }) {
  const [status, setStatus] = useState<StatusFilter>("ongoing");
  const [brand, setBrand] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<StatusFilter, number> = { ongoing: 0, upcoming: 0, ended: 0, all: popups.length };
    for (const p of popups) out[popupStatus(p)] += 1;
    return out;
  }, [popups]);

  const brands = useMemo(() => [...new Set(popups.map((p) => p.brand))].sort(), [popups]);
  const cities = useMemo(() => [...new Set(popups.map((p) => p.city).filter(Boolean))].sort(), [popups]);

  const visible = useMemo(() => {
    const filtered = popups.filter(
      (p) =>
        (status === "all" || popupStatus(p) === status) &&
        (!brand || p.brand === brand) &&
        (!city || p.city === city),
    );
    return sortPopups(filtered);
  }, [popups, status, brand, city]);

  return (
    <div className="space-y-5">
      {/* 상태 탭 */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              status === t.id
                ? "border-amber-400 bg-amber-500 text-amber-950"
                : "border-amber-400/25 text-amber-100/90 hover:border-amber-400/60",
            )}
          >
            {t.label}
            <span className="ml-1 text-xs opacity-70 tabular-nums">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {/* 브랜드 · 지역 */}
      <div className="space-y-2">
        <FilterRow label="브랜드" options={brands} value={brand} onChange={setBrand} />
        {cities.length > 1 && <FilterRow label="지역" options={cities} value={city} onChange={setCity} />}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-amber-400/25 p-8 text-center text-sm text-muted-foreground">
          조건에 맞는 팝업이 없어요. 다른 탭을 눌러보세요.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map((p) => (
            <li key={p.id}>
              <PopupCard popup={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs transition-colors",
          value === null ? "border-amber-400/70 text-amber-200" : "border-amber-400/20 text-muted-foreground hover:border-amber-400/50",
        )}
      >
        전체
      </button>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? null : o)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            value === o ? "border-amber-400 bg-amber-500/15 text-amber-200" : "border-amber-400/20 text-muted-foreground hover:border-amber-400/50",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
