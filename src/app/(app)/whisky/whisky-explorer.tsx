"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WhiskyCard } from "@/components/whisky/whisky-card";
import { cn } from "@/lib/utils";
import { TYPE_SHORT_KO } from "@/lib/whisky/format";
import { hasProfile, matchPercent } from "@/lib/whisky/recommend";
import type { TasteProfile, Whisky, WhiskyType } from "@/lib/whisky/types";

type SortKey = "match" | "price_asc" | "price_desc" | "easy";

const TYPE_ORDER: WhiskyType[] = [
  "single_malt",
  "blended_scotch",
  "bourbon",
  "rye",
  "irish",
  "japanese",
  "other",
];

const PRICE_BUCKETS: { id: string; label: string; max: number | null }[] = [
  { id: "all", label: "전체 가격", max: null },
  { id: "5", label: "5만 원 이하", max: 50000 },
  { id: "10", label: "10만 원 이하", max: 100000 },
  { id: "20", label: "20만 원 이하", max: 200000 },
];

export function WhiskyExplorer({
  whiskies,
  profile,
}: {
  whiskies: Whisky[];
  profile: TasteProfile | null;
}) {
  const personalized = hasProfile(profile);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<WhiskyType | "all">("all");
  const [price, setPrice] = useState("all");
  const [noPeat, setNoPeat] = useState(false);
  const [sort, setSort] = useState<SortKey>(personalized ? "match" : "easy");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const maxPrice = PRICE_BUCKETS.find((b) => b.id === price)?.max ?? null;
    const list = whiskies
      .filter((w) => type === "all" || w.type === type)
      .filter((w) => maxPrice === null || w.priceKrw[0] <= maxPrice)
      .filter((w) => !noPeat || w.flavor.peat <= 1)
      .filter((w) => {
        if (!q) return true;
        const hay = [w.nameKo, w.name, w.distillery, ...(w.aliases ?? [])]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .map((w) => ({
        whisky: w,
        percent: personalized && profile ? matchPercent(profile, w) : null,
      }));

    list.sort((a, b) => {
      switch (sort) {
        case "match":
          return (b.percent ?? -1) - (a.percent ?? -1);
        case "price_asc":
          return a.whisky.priceKrw[0] - b.whisky.priceKrw[0];
        case "price_desc":
          return b.whisky.priceKrw[0] - a.whisky.priceKrw[0];
        case "easy":
        default:
          return (
            a.whisky.difficulty - b.whisky.difficulty ||
            a.whisky.priceKrw[0] - b.whisky.priceKrw[0]
          );
      }
    });
    return list;
  }, [whiskies, query, type, price, noPeat, sort, personalized, profile]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름, 증류소로 검색 (예: 글렌피딕, Macallan)"
            className="pl-9"
            aria-label="위스키 검색"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={type === "all"} onClick={() => setType("all")}>
            전체
          </Chip>
          {TYPE_ORDER.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {TYPE_SHORT_KO[t]}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRICE_BUCKETS.map((b) => (
            <Chip key={b.id} active={price === b.id} onClick={() => setPrice(b.id)}>
              {b.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
          <Chip active={noPeat} onClick={() => setNoPeat((v) => !v)}>
            🔥 연기 향 빼기
          </Chip>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{results.length}병</span>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">정렬</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              {personalized && <option value="match">내 취향 순</option>}
              <option value="easy">입문하기 쉬운 순</option>
              <option value="price_asc">가격 낮은 순</option>
              <option value="price_desc">가격 높은 순</option>
            </select>
          </label>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          조건에 맞는 위스키가 없어요. 필터를 조금 풀어보세요.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ whisky, percent }) => (
            <li key={whisky.id}>
              <WhiskyCard whisky={whisky} percent={percent} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-amber-600 bg-amber-600 text-white"
          : "border-border bg-card text-foreground hover:border-amber-600/60",
      )}
    >
      {children}
    </button>
  );
}
