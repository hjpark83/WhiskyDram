"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WhiskyCard } from "@/components/whisky/whisky-card";
import { cn } from "@/lib/utils";
import {
  getOrigin,
  ORIGIN_DESCRIPTIONS_KO,
  ORIGIN_LABELS_KO,
  ORIGIN_ORDER,
  STYLE_DESCRIPTIONS_KO,
  STYLE_EMOJI,
  STYLE_LABELS_KO,
  STYLE_ORDER,
  TYPE_SHORT_KO,
} from "@/lib/whisky/format";
import { hasProfile, matchPercent } from "@/lib/whisky/recommend";
import type { Origin, StyleTag, TasteProfile, Whisky, WhiskyType } from "@/lib/whisky/types";

type SortKey = "match" | "price_asc" | "price_desc" | "easy" | "age_desc";

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
  { id: "all", label: "전체", max: null },
  { id: "5", label: "5만 원 이하", max: 50000 },
  { id: "10", label: "10만 원 이하", max: 100000 },
  { id: "20", label: "20만 원 이하", max: 200000 },
];

/**
 * 숙성 연수. 위스키 가격은 연수를 따라가서, "12년짜리로 보여줘" 가
 * 실제로 제일 많이 쓰는 조건이에요.
 * 연수를 안 적는 병(NAS)은 숫자가 없으니 따로 골라야 해요.
 */
const AGE_BUCKETS: {
  id: string;
  label: string;
  match: (age: number | null) => boolean;
}[] = [
  { id: "all", label: "전체", match: () => true },
  { id: "nas", label: "연수 표기 없음", match: (a) => a === null },
  { id: "u10", label: "10년 미만", match: (a) => a !== null && a < 10 },
  { id: "10s", label: "10~14년", match: (a) => a !== null && a >= 10 && a < 15 },
  { id: "15s", label: "15~19년", match: (a) => a !== null && a >= 15 && a < 20 },
  { id: "20+", label: "20년 이상", match: (a) => a !== null && a >= 20 },
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
  const [origin, setOrigin] = useState<Origin | "all">("all");
  const [type, setType] = useState<WhiskyType | "all">("all");
  const [styles, setStyles] = useState<StyleTag[]>([]);
  const [price, setPrice] = useState("all");
  const [age, setAge] = useState("all");
  const [distillery, setDistillery] = useState("all");
  const [sort, setSort] = useState<SortKey>(personalized ? "match" : "easy");

  // 원산지를 고르면 그 안에 실제로 있는 종류만 칩으로 보여줘요.
  const typesInOrigin = useMemo(() => {
    const set = new Set<WhiskyType>();
    for (const w of whiskies) if (origin === "all" || getOrigin(w) === origin) set.add(w.type);
    return TYPE_ORDER.filter((t) => set.has(t));
  }, [whiskies, origin]);

  /**
   * 증류소 목록. 500병이 넘어 전부 칩으로 깔면 화면을 덮어서 <select> 로 두고,
   * 지금 걸린 나라·종류 안에 실제로 있는 증류소만 병 수와 함께 보여줘요.
   */
  const distilleries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of whiskies) {
      if (origin !== "all" && getOrigin(w) !== origin) continue;
      if (type !== "all" && w.type !== type) continue;
      counts.set(w.distillery, (counts.get(w.distillery) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [whiskies, origin, type]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const maxPrice = PRICE_BUCKETS.find((b) => b.id === price)?.max ?? null;
    const list = whiskies
      .filter((w) => origin === "all" || getOrigin(w) === origin)
      .filter((w) => type === "all" || w.type === type)
      .filter((w) => styles.every((s) => w.styles.includes(s)))
      .filter((w) => maxPrice === null || w.priceKrw[0] <= maxPrice)
      .filter((w) => (AGE_BUCKETS.find((b) => b.id === age) ?? AGE_BUCKETS[0]).match(w.age))
      .filter((w) => distillery === "all" || w.distillery === distillery)
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
        case "age_desc":
          // 연수를 안 적는 병은 비교할 숫자가 없어서 뒤로 보내요
          return (b.whisky.age ?? -1) - (a.whisky.age ?? -1);
        case "easy":
        default:
          return (
            a.whisky.difficulty - b.whisky.difficulty ||
            a.whisky.priceKrw[0] - b.whisky.priceKrw[0]
          );
      }
    });
    return list;
  }, [whiskies, query, origin, type, styles, price, age, distillery, sort, personalized, profile]);

  const activeCount =
    (origin !== "all" ? 1 : 0) +
    (type !== "all" ? 1 : 0) +
    styles.length +
    (price !== "all" ? 1 : 0) +
    (age !== "all" ? 1 : 0) +
    (distillery !== "all" ? 1 : 0);

  function reset() {
    setOrigin("all");
    setType("all");
    setStyles([]);
    setPrice("all");
    setAge("all");
    setDistillery("all");
    setQuery("");
  }

  function toggleStyle(tag: StyleTag) {
    setStyles((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
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

        <FilterRow label="원산지" hint={origin !== "all" ? ORIGIN_DESCRIPTIONS_KO[origin] : undefined}>
          <Chip active={origin === "all"} onClick={() => setOrigin("all")}>
            전체
          </Chip>
          {ORIGIN_ORDER.map((o) => (
            <Chip
              key={o}
              active={origin === o}
              onClick={() => {
                setOrigin(o);
                setType("all");
                setDistillery("all");
              }}
            >
              {ORIGIN_LABELS_KO[o]}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="종류">
          <Chip active={type === "all"} onClick={() => setType("all")}>
            전체
          </Chip>
          {typesInOrigin.map((t) => (
            <Chip
              key={t}
              active={type === t}
              onClick={() => {
                setType(t);
                setDistillery("all");
              }}
            >
              {TYPE_SHORT_KO[t]}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow
          label="스타일"
          hint={
            styles.length > 0
              ? STYLE_DESCRIPTIONS_KO[styles[styles.length - 1]]
              : "여러 개 고르면 모두 해당하는 병만 보여요."
          }
        >
          {STYLE_ORDER.map((tag) => (
            <Chip key={tag} active={styles.includes(tag)} onClick={() => toggleStyle(tag)}>
              {STYLE_EMOJI[tag]} {STYLE_LABELS_KO[tag]}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="가격">
          {PRICE_BUCKETS.map((b) => (
            <Chip key={b.id} active={price === b.id} onClick={() => setPrice(b.id)}>
              {b.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="숙성 연수" hint="숫자가 클수록 오래 익힌 술이에요. 보통 가격도 같이 올라가요.">
          {AGE_BUCKETS.map((b) => (
            <Chip key={b.id} active={age === b.id} onClick={() => setAge(b.id)}>
              {b.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="증류소" hint="위스키를 만든 곳이에요. 같은 곳에서 여러 병이 나와요.">
          <select
            value={distillery}
            onChange={(e) => setDistillery(e.target.value)}
            className="h-8 max-w-full rounded-md border bg-background px-2 text-sm"
            aria-label="증류소로 거르기"
          >
            <option value="all">전체 ({distilleries.length}곳)</option>
            {distilleries.map(([name, count]) => (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            ))}
          </select>
        </FilterRow>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{results.length}병</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:border-amber-400/60"
              >
                <X className="size-3" aria-hidden />
                필터 초기화
              </button>
            )}
          </div>
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
              <option value="age_desc">숙성 연수 긴 순</option>
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

      <details className="rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-medium">분류가 헷갈리면 여기를 눌러보세요</summary>
        <dl className="mt-3 space-y-3 text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">원산지</dt>
            <dd>어느 나라에서 만들었는지. 나라마다 만드는 규칙과 대표적인 맛이 달라요.</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">종류</dt>
            <dd>
              어떻게 만들었는지. <b>싱글몰트</b>는 한 증류소에서 보리로만, <b>블렌디드</b>는 여러
              증류소 원액을 섞어서, <b>버번</b>은 옥수수 위주로 새 오크통에서.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">스타일</dt>
            <dd>
              어떤 통에서 숙성했는지와 대표 특징. 셰리 통이면 건포도 같은 단맛, 피트면 연기 향.
              한 병에 여러 스타일이 붙을 수 있어요.
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

function FilterRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[3.5rem_1fr] sm:items-start">
      <span className="pt-1 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">{children}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
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
          ? "border-amber-400 bg-amber-500 text-amber-950"
          : "border-border bg-card text-foreground hover:border-amber-400/60",
      )}
    >
      {children}
    </button>
  );
}
