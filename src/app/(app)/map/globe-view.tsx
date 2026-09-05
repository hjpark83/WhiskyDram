"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { ChevronDown, ChevronRight, ChevronUp, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MatchBadge } from "@/components/whisky/whisky-card";
import { cn } from "@/lib/utils";
import {
  formatPriceRange,
  ORIGIN_LABELS_KO,
  REGION_LABELS_KO,
  STYLE_EMOJI,
  STYLE_LABELS_KO,
  TYPE_SHORT_KO,
} from "@/lib/whisky/format";
import type { Origin, Region, StyleTag, Whisky, WhiskyType } from "@/lib/whisky/types";
import {
  altitudeForSpread,
  buildCountryGroups,
  buildRegionGroups,
  clusterPins,
  countryKey,
  REGION_ZOOM,
  searchDistilleries,
  type GroupNode,
  type PinNode,
} from "./cluster";
import { buildLandTextureUrl } from "./land-texture";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-amber-200/60">
      지구본을 불러오는 중…
    </div>
  ),
});

export interface GlobeWhisky {
  id: string;
  nameKo: string;
  name: string;
  type: WhiskyType;
  styles: StyleTag[];
  priceKrw: Whisky["priceKrw"];
  difficulty: Whisky["difficulty"];
  abv: number;
  percent: number | null;
}

export interface GlobeDistillery {
  name: string;
  nameKo: string;
  founded: number | null;
  blurb: string;
  country: string;
  region: Region;
  origin: Origin;
  lat: number;
  lng: number;
  whiskies: GlobeWhisky[];
  bestPercent: number | null;
}

const ORIGIN_COLORS: Record<Origin, string> = {
  scotch: "#f0c96a",
  irish: "#4ade80",
  japanese: "#f87171",
  american: "#60a5fa",
  korean: "#f472b6",
  other: "#c4b5fd",
};

/**
 * 빠른 이동 칩. `country` 만 있으면 그 나라의 지역 보기로,
 * `region` 까지 있으면 그 지역의 증류소 보기로 바로 들어가요.
 * 좌표·고도는 실제 데이터에서 계산한 값을 쓰기 때문에 여기 적지 않아요.
 */
const VIEWS: { id: string; label: string; country?: string; region?: Region }[] = [
  { id: "world", label: "전체" },
  { id: "scotland", label: "스코틀랜드", country: "스코틀랜드" },
  { id: "speyside", label: "스페이사이드", country: "스코틀랜드", region: "Speyside" },
  { id: "islay", label: "아일라 섬", country: "스코틀랜드", region: "Islay" },
  { id: "ireland", label: "아일랜드", country: "아일랜드" },
  { id: "kentucky", label: "켄터키", country: "미국", region: "Kentucky" },
  { id: "japan", label: "일본", country: "일본" },
  { id: "korea", label: "한국", country: "한국" },
];

/** 지구본에 지금 무엇을 띄울지 */
type Stage = "countries" | "regions" | "pins";

const POT_STILL_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3h6v2l-1 1v2.3c2.6 1 4.2 3.6 4.2 6.7V19a2 2 0 0 1-2 2H7.8a2 2 0 0 1-2-2v-4c0-3.1 1.6-5.7 4.2-6.7V6L9 5V3z" fill="currentColor"/><path d="M15 8.5c3.2.3 4.6 2 4.6 4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

function matchColor(percent: number | null): string {
  if (percent === null) return "#a8a29e";
  if (percent >= 75) return "#f5b73a";
  if (percent >= 60) return "#e8c66f";
  if (percent >= 45) return "#c9b48a";
  return "#6b6258";
}

interface Focus {
  country?: string;
  region?: Region;
}

export function GlobeView({
  distilleries,
  personalized,
}: {
  distilleries: GlobeDistillery[];
  personalized: boolean;
}) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerEls = useRef(new Map<string, HTMLElement>());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<GlobeDistillery | null>(null);
  const [focus, setFocus] = useState<Focus>({});
  const [activeView, setActiveView] = useState("world");
  const [altitude, setAltitude] = useState(2.2);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [globeImage, setGlobeImage] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("countries");
  /** 프로그램이 카메라를 옮기는 동안엔 줌 이벤트로 단계를 바꾸지 않아요 */
  const flyingUntil = useRef(0);

  const countryGroups = useMemo(() => buildCountryGroups(distilleries), [distilleries]);
  const allRegionGroups = useMemo(() => buildRegionGroups(distilleries), [distilleries]);

  /** 지금 보고 있는 범위 (나라·지역을 고르면 그 안만) */
  const inFocus = useMemo(() => {
    if (!focus.country) return distilleries;
    return distilleries.filter(
      (d) => countryKey(d.country) === focus.country && (!focus.region || d.region === focus.region),
    );
  }, [distilleries, focus]);

  const regionGroups = useMemo(
    () => (focus.country ? allRegionGroups.filter((r) => r.country === focus.country) : allRegionGroups),
    [allRegionGroups, focus.country],
  );

  const pins = useMemo(
    () => (stage === "pins" ? clusterPins(inFocus, altitude) : []),
    [stage, inFocus, altitude],
  );

  const results = useMemo(() => searchDistilleries(distilleries, query), [distilleries, query]);

  /** 지구본에 얹을 마커: 단계에 따라 나라 / 지역 / 증류소 */
  const markers = useMemo<(GroupNode | PinNode)[]>(() => {
    if (stage === "countries") return countryGroups;
    if (stage === "regions") return regionGroups;
    return pins;
  }, [stage, countryGroups, regionGroups, pins]);

  // 육지를 밝게 칠한 텍스처를 한 번 만들어요 (실패하면 기본 텍스처)
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    buildLandTextureUrl().then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      url = u;
      if (u) setGlobeImage(u);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * 손으로 확대·축소했을 때만 단계를 바꿔요.
   * 아주 멀어지면 전체 보기로 돌아가고, 전체 보기에서 당겨 들어오면 지역 보기로.
   */
  const handleZoom = useCallback((pov: { altitude: number }) => {
    setAltitude(pov.altitude);
    if (Date.now() < flyingUntil.current) return;
    if (pov.altitude > REGION_ZOOM) {
      setStage("countries");
      setFocus((f) => (f.country ? {} : f));
    } else {
      setStage((s) => (s === "countries" ? "regions" : s));
    }
  }, []);

  const flyTo = useCallback((lat: number, lng: number, alt: number, ms = 900) => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = false;
    flyingUntil.current = Date.now() + ms + 200;
    g.pointOfView({ lat, lng, altitude: alt }, ms);
  }, []);

  const onReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const c = g.controls();
    c.autoRotate = true;
    c.autoRotateSpeed = 0.4;
    c.enableZoom = true;
    g.pointOfView({ lat: 40, lng: -10, altitude: 2.1 }, 0);
  }, []);

  const selectDistillery = useCallback(
    (d: GlobeDistillery) => {
      setSelected(d);
      setActiveView("");
      setSheetOpen(true);
      setQuery("");
      setFocus({ country: countryKey(d.country), region: d.region });
      setStage("pins");
      flyTo(d.lat, d.lng, Math.min(0.12, Math.max(0.03, altitude)), 1100);
    },
    [flyTo, altitude],
  );

  const selectGroup = useCallback(
    (g: GroupNode) => {
      setSelected(null);
      setQuery("");
      setActiveView("");
      setFocus(g.kind === "country" ? { country: g.country } : { country: g.country, region: g.region ?? undefined });
      setStage(g.kind === "country" ? "regions" : "pins");
      flyTo(g.lat, g.lng, g.altitude, 1100);
    },
    [flyTo],
  );

  /** 숫자 뱃지를 누르면 한 단계 더 파고들어 흩어지게 해요 */
  const splitCluster = useCallback(
    (p: PinNode) => {
      setSelected(null);
      // 이 묶음이 화면을 채울 만큼만 들어가요 (한 번에 흩어지게)
      const k = Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      const spread = Math.max(
        ...p.items.map((d) => Math.hypot(d.lat - p.lat, (d.lng - p.lng) * k)),
        0.01,
      );
      flyTo(p.lat, p.lng, Math.min(altitude * 0.6, altitudeForSpread(spread)), 800);
    },
    [flyTo, altitude],
  );

  const resetView = useCallback(() => {
    setFocus({});
    setSelected(null);
    setQuery("");
    setActiveView("world");
    setStage("countries");
    flyTo(30, 20, 2.4, 1100);
  }, [flyTo]);

  // 선택 상태를 핀 DOM 에 반영 (CSS2D 요소는 React 밖에 있어요)
  useEffect(() => {
    for (const [name, el] of markerEls.current) {
      el.classList.toggle("is-selected", selected?.name === name);
    }
  }, [selected, stage]);

  const htmlElement = useCallback(
    (obj: object) => {
      const el = document.createElement("div");
      el.className = "globe-marker";
      const inner = document.createElement("div");

      if ("items" in obj) {
        const pin = obj as PinNode;
        if (pin.items.length === 1) {
          const d = pin.items[0];
          inner.className = "globe-pin-inner";
          inner.dataset.label = `${d.nameKo}${d.whiskies.length > 0 ? ` · ${d.whiskies.length}병` : ""}`;
          inner.innerHTML = POT_STILL_SVG;
          if (personalized) inner.style.color = matchColor(d.bestPercent);
          el.appendChild(inner);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            selectDistillery(d);
          });
          markerEls.current.set(d.name, el);
          if (selected?.name === d.name) el.classList.add("is-selected");
        } else {
          // 겹치는 증류소 묶음 — 누르면 확대되면서 흩어져요
          inner.className = "globe-count-inner";
          inner.dataset.label = `증류소 ${pin.items.length}곳 · 눌러서 확대`;
          inner.innerHTML = `<b>${pin.items.length}</b>`;
          if (personalized) inner.style.borderColor = matchColor(pin.bestPercent);
          el.appendChild(inner);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            splitCluster(pin);
          });
        }
      } else {
        const g = obj as GroupNode;
        inner.className = "globe-cluster-inner";
        inner.innerHTML = `<span>${g.emoji}</span><b>${g.label}</b><small>증류소 ${g.count}</small>`;
        el.appendChild(inner);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectGroup(g);
        });
      }
      return el;
    },
    [personalized, selectDistillery, selectGroup, splitCluster, selected],
  );

  const topByMatch = useMemo(
    () =>
      personalized
        ? [...inFocus]
            .filter((d) => d.bestPercent !== null)
            .sort((a, b) => (b.bestPercent ?? 0) - (a.bestPercent ?? 0))
            .slice(0, 8)
        : [],
    [inFocus, personalized],
  );

  const focusedRegionLabel = focus.region ? REGION_LABELS_KO[focus.region] : null;

  const searchBox = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length > 0) selectDistillery(results[0]);
          if (e.key === "Escape") setQuery("");
        }}
        placeholder="증류소·위스키 이름으로 찾기"
        aria-label="증류소 검색"
        className="w-full rounded-full border border-amber-400/25 bg-black/40 py-2 pl-9 pr-3 text-sm text-amber-50 outline-none placeholder:text-muted-foreground focus:border-amber-400/70"
      />
    </div>
  );

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="현재 위치">
      <button type="button" onClick={resetView} className="rounded px-1 hover:text-amber-300">
        전체
      </button>
      {focus.country && (
        <>
          <ChevronRight className="size-3" aria-hidden />
          <button
            type="button"
            onClick={() => {
              const g = countryGroups.find((c) => c.key === focus.country);
              if (g) selectGroup(g);
            }}
            className="rounded px-1 hover:text-amber-300"
          >
            {focus.country}
          </button>
        </>
      )}
      {focusedRegionLabel && (
        <>
          <ChevronRight className="size-3" aria-hidden />
          <span className="px-1 text-amber-300">{focusedRegionLabel}</span>
        </>
      )}
    </nav>
  );

  /** 목록 한 줄 */
  const DistilleryRow = ({ d }: { d: GlobeDistillery }) => (
    <li>
      <button
        type="button"
        onClick={() => selectDistillery(d)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-left text-sm transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{d.nameKo}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {REGION_LABELS_KO[d.region]} · {d.whiskies.length}병
          </span>
        </span>
        {personalized ? (
          <MatchBadge percent={d.bestPercent} />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
    </li>
  );

  const GroupRow = ({ g }: { g: GroupNode }) => (
    <li>
      <button
        type="button"
        onClick={() => selectGroup(g)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-left text-sm transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
      >
        <span className="min-w-0">
          <span className="block truncate">
            {g.emoji} <span className="font-medium">{g.label}</span>
          </span>
          {g.sublabel && <span className="block truncate text-xs text-muted-foreground">{g.sublabel}</span>}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          증류소 {g.count} · {g.bottles}병
        </span>
      </button>
    </li>
  );

  const panel = selected ? (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{ORIGIN_LABELS_KO[selected.origin]}</Badge>
            {selected.region !== "Other" && <Badge variant="outline">{REGION_LABELS_KO[selected.region]}</Badge>}
            {selected.founded && <Badge variant="outline">{selected.founded}년 설립</Badge>}
          </div>
          <h2 className="mt-2 text-2xl text-amber-100">{selected.nameKo}</h2>
          <p className="text-xs text-muted-foreground">
            {selected.name} · {selected.country}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="rounded-full p-1 text-muted-foreground hover:bg-amber-500/15"
          aria-label="닫기"
        >
          <X className="size-4" />
        </button>
      </div>
      {selected.blurb && <p className="text-sm leading-relaxed text-amber-50/85">{selected.blurb}</p>}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          이 증류소의 위스키 {selected.whiskies.length}병
        </p>
        <ul className="space-y-1.5">
          {[...selected.whiskies]
            .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.priceKrw[0] - b.priceKrw[0])
            .map((w) => (
              <li key={w.id}>
                <Link
                  href={`/whisky/${w.id}`}
                  className="block rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{w.nameKo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {TYPE_SHORT_KO[w.type]} · {w.abv}% · {formatPriceRange(w.priceKrw)}
                      </p>
                    </div>
                    <MatchBadge percent={w.percent} />
                  </div>
                  {w.styles.length > 0 && (
                    <p className="mt-1 text-xs text-amber-300">
                      {w.styles.map((t) => `${STYLE_EMOJI[t]} ${STYLE_LABELS_KO[t]}`).join("  ")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="text-xs text-amber-300 underline-offset-2 hover:underline"
      >
        ← {focusedRegionLabel ?? focus.country ?? "전체"} 증류소 목록으로
      </button>
    </div>
  ) : (
    <div className="space-y-4">
      {searchBox}

      {query.trim() ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            검색 결과 {results.length}곳
          </p>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">이름이 안 걸렸어요. 다른 말로 찾아보세요.</p>
          ) : (
            <ul className="space-y-1.5">
              {results.map((d) => (
                <DistilleryRow key={d.name} d={d} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {breadcrumb}

          {/* 지역 칩: 나라를 골랐으면 그 나라의 지역들 */}
          {focus.country && regionGroups.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {[...regionGroups]
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => selectGroup(r)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      focus.region === r.region
                        ? "border-amber-400 bg-amber-500 text-amber-950"
                        : "border-amber-400/25 text-amber-100/90 hover:border-amber-400/60",
                    )}
                  >
                    {r.label} {r.count}
                  </button>
                ))}
            </div>
          )}

          {/* 목록: 아직 나라를 안 골랐으면 나라, 골랐으면 증류소 */}
          {!focus.country ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                나라를 골라보세요
              </p>
              <ul className="space-y-1.5">
                {[...countryGroups]
                  .sort((a, b) => b.count - a.count)
                  .map((g) => (
                    <GroupRow key={g.key} g={g} />
                  ))}
              </ul>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {focusedRegionLabel ?? focus.country} 증류소 {inFocus.length}곳
              </p>
              <ul className="space-y-1.5">
                {[...inFocus]
                  .sort(
                    (a, b) =>
                      (b.bestPercent ?? -1) - (a.bestPercent ?? -1) ||
                      b.whiskies.length - a.whiskies.length ||
                      a.nameKo.localeCompare(b.nameKo),
                  )
                  .map((d) => (
                    <DistilleryRow key={d.name} d={d} />
                  ))}
              </ul>
            </div>
          )}

          {topByMatch.length > 0 && !focus.region && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                내 취향과 가까운 증류소
              </p>
              <ul className="space-y-1.5">
                {topByMatch.slice(0, 5).map((d) => (
                  <DistilleryRow key={`m-${d.name}`} d={d} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );

  const hint =
    stage === "countries"
      ? "나라를 누르면 가까이 날아가요."
      : stage === "regions"
        ? "지역을 누르면 증류소가 하나씩 보여요."
        : "숫자 뱃지는 겹친 증류소예요. 누르면 흩어져요.";

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-x-0 bottom-[3.5rem] top-14 z-0 bg-[#0a0705] sm:bottom-0",
        altitude < 0.3 && "is-close",
        stage === "pins" && pins.length <= 9 && "show-labels",
      )}
      onPointerDown={() => {
        const g = globeRef.current;
        if (g) g.controls().autoRotate = false;
      }}
    >
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(10,7,5,1)"
          globeImageUrl={globeImage ?? "/textures/earth-dark.jpg"}
          bumpImageUrl="/textures/earth-topology.png"
          atmosphereColor="#e8b850"
          atmosphereAltitude={0.17}
          rendererConfig={{ preserveDrawingBuffer: true, antialias: true }}
          onGlobeReady={onReady}
          onZoom={handleZoom}
          // 멀리서는 작은 점으로 분포만 보여주고, 가까이서는 아이콘이 대신해요
          pointsData={stage === "pins" ? [] : distilleries}
          pointLat="lat"
          pointLng="lng"
          pointColor={(p: object) =>
            personalized ? matchColor((p as GlobeDistillery).bestPercent) : ORIGIN_COLORS[(p as GlobeDistillery).origin]
          }
          pointAltitude={0.004}
          // 점은 분포를 보여주는 용도라 확대할수록 작아져야 해요 (안 그러면 덩어리로 보여요)
          pointRadius={Math.max(0.015, Math.min(0.16, altitude * 0.07))}
          pointsMerge={true}
          htmlElementsData={markers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={stage === "pins" ? 0.01 : 0.03}
          htmlElement={htmlElement}
          htmlElementVisibilityModifier={(el: HTMLElement, isVisible: boolean) => {
            el.style.visibility = isVisible ? "visible" : "hidden";
          }}
          htmlTransitionDuration={0}
        />
      )}

      {/* 좌상단: 제목 + 빠른 이동 */}
      <div className="glass pointer-events-auto absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-2xl p-3 sm:left-5 sm:top-5 sm:max-w-md sm:p-4">
        <h1 className="text-lg text-amber-100 sm:text-xl">증류소 지도</h1>
        <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
          {distilleries.length}곳의 증류소 · {hint}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveView(v.id);
                setSelected(null);
                setQuery("");
                if (!v.country) {
                  resetView();
                  setActiveView("world");
                  return;
                }
                const target = v.region
                  ? allRegionGroups.find((r) => r.country === v.country && r.region === v.region)
                  : countryGroups.find((g) => g.key === v.country);
                if (target) selectGroup(target);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors sm:text-xs",
                activeView === v.id
                  ? "border-amber-400 bg-amber-500 text-amber-950"
                  : "border-amber-400/25 bg-transparent text-amber-100/90 hover:border-amber-400/60",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* 좌하단: 범례 (데스크톱) */}
      <div className="pointer-events-none absolute bottom-4 left-5 hidden flex-wrap gap-2 text-[11px] text-amber-100/80 sm:flex">
        {personalized ? (
          <>
            <Legend color="#f5b73a" label="75%+" />
            <Legend color="#e8c66f" label="60%+" />
            <Legend color="#c9b48a" label="45%+" />
            <Legend color="#6b6258" label="그 이하" />
          </>
        ) : (
          (Object.keys(ORIGIN_COLORS) as Origin[]).map((o) => (
            <Legend key={o} color={ORIGIN_COLORS[o]} label={ORIGIN_LABELS_KO[o]} />
          ))
        )}
        <span className="rounded-full bg-black/40 px-2 py-0.5">
          {stage === "countries" ? "나라 보기" : stage === "regions" ? "지역 보기" : "증류소 보기"} · 스크롤로 확대
        </span>
      </div>

      {/* 우측: 정보 패널 (데스크톱) */}
      <aside className="glass absolute right-5 top-5 hidden max-h-[calc(100%-2.5rem)] w-96 overflow-y-auto rounded-2xl p-5 sm:block">
        {panel}
      </aside>

      {/* 모바일: 하단 시트 */}
      <div className="glass absolute inset-x-3 bottom-3 max-h-[52vh] overflow-hidden rounded-2xl sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
        >
          <span>{selected ? selected.nameKo : (focusedRegionLabel ?? focus.country ?? "증류소 찾기")}</span>
          {sheetOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
        {sheetOpen && <div className="max-h-[44vh] overflow-y-auto px-4 pb-4">{panel}</div>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5">
      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
