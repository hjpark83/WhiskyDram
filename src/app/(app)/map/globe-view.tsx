"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { ChevronDown, ChevronUp, MapPin, X } from "lucide-react";
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

/** 1단계: 나라·지역 묶음 */
interface Cluster {
  key: string;
  label: string;
  emoji: string;
  lat: number;
  lng: number;
  altitude: number;
  count: number;
  bottles: number;
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

const COUNTRY_EMOJI: Record<string, string> = {
  스코틀랜드: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  아일랜드: "🇮🇪",
  북아일랜드: "🇮🇪",
  미국: "🇺🇸",
  일본: "🇯🇵",
  한국: "🇰🇷",
  대만: "🇹🇼",
  인도: "🇮🇳",
  호주: "🇦🇺",
  웨일스: "🇬🇧",
  "영국(잉글랜드)": "🇬🇧",
  캐나다: "🇨🇦",
};

const VIEWS: { id: string; label: string; lat: number; lng: number; altitude: number }[] = [
  { id: "world", label: "전체", lat: 30, lng: 20, altitude: 2.4 },
  { id: "scotland", label: "스코틀랜드", lat: 57, lng: -4.2, altitude: 0.5 },
  { id: "islay", label: "아일라 섬", lat: 55.75, lng: -6.2, altitude: 0.2 },
  { id: "ireland", label: "아일랜드", lat: 53.3, lng: -7.5, altitude: 0.55 },
  { id: "kentucky", label: "켄터키", lat: 37.9, lng: -85.2, altitude: 0.55 },
  { id: "japan", label: "일본", lat: 36.5, lng: 137.5, altitude: 0.9 },
  { id: "korea", label: "한국", lat: 37.6, lng: 127.1, altitude: 0.5 },
];

/** 이 고도보다 가까우면 증류소 핀, 멀면 나라·지역 묶음 */
const ZOOM_THRESHOLD = 1.15;

const POT_STILL_SVG =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3h6v2l-1 1v2.3c2.6 1 4.2 3.6 4.2 6.7V19a2 2 0 0 1-2 2H7.8a2 2 0 0 1-2-2v-4c0-3.1 1.6-5.7 4.2-6.7V6L9 5V3z" fill="currentColor"/><path d="M15 8.5c3.2.3 4.6 2 4.6 4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

function matchColor(percent: number | null): string {
  if (percent === null) return "#a8a29e";
  if (percent >= 75) return "#f5b73a";
  if (percent >= 60) return "#e8c66f";
  if (percent >= 45) return "#c9b48a";
  return "#6b6258";
}

const COUNTRY_MERGE: Record<string, string> = {
  북아일랜드: "아일랜드",
  웨일스: "영국",
  "영국(잉글랜드)": "영국",
};

function buildClusters(distilleries: GlobeDistillery[]): Cluster[] {
  const groups = new Map<string, GlobeDistillery[]>();
  for (const d of distilleries) {
    const key = COUNTRY_MERGE[d.country] ?? d.country;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.entries()].map(([label, list]) => {
    const lat = list.reduce((a, d) => a + d.lat, 0) / list.length;
    const lng = list.reduce((a, d) => a + d.lng, 0) / list.length;
    const emoji = COUNTRY_EMOJI[list[0].country] ?? "🥃";
    const spread = Math.max(...list.map((d) => Math.hypot(d.lat - lat, d.lng - lng)), 0.3);
    const percents = list.map((d) => d.bestPercent).filter((p): p is number => p !== null);
    return {
      key: label,
      label,
      emoji,
      lat,
      lng,
      // 흩어진 정도에 맞춰 확대 깊이 결정 (스코틀랜드 0.5 안팎, 미국 0.9)
      altitude: Math.max(0.3, Math.min(0.95, spread * 0.1)),
      count: list.length,
      bottles: list.reduce((a, d) => a + d.whiskies.length, 0),
      bestPercent: percents.length ? Math.max(...percents) : null,
    };
  });
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
  const [activeView, setActiveView] = useState("world");
  const [altitude, setAltitude] = useState(2.2);
  const [sheetOpen, setSheetOpen] = useState(true);
  const zoomed = altitude < ZOOM_THRESHOLD;

  const clusters = useMemo(() => buildClusters(distilleries), [distilleries]);

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

  const flyTo = useCallback((lat: number, lng: number, alt: number, ms = 900) => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = false;
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
      flyTo(d.lat, d.lng + 3, Math.min(0.4, Math.max(0.2, altitude)));
    },
    [flyTo, altitude],
  );

  const selectCluster = useCallback(
    (c: Cluster) => {
      setSelected(null);
      setActiveView(c.key);
      flyTo(c.lat, c.lng, c.altitude);
    },
    [flyTo],
  );

  // 선택 상태를 핀 DOM 에 반영 (CSS2D 요소는 React 밖에 있어요)
  useEffect(() => {
    for (const [name, el] of markerEls.current) {
      el.classList.toggle("is-selected", selected?.name === name);
    }
  }, [selected, zoomed]);

  const htmlElement = useCallback(
    (obj: object) => {
      const el = document.createElement("div");
      el.className = "globe-marker";
      if ("whiskies" in obj) {
        const d = obj as GlobeDistillery;
        const inner = document.createElement("div");
        inner.className = "globe-pin-inner";
        inner.dataset.label = `${d.nameKo} · ${d.whiskies.length}병${d.bestPercent !== null ? ` · ${d.bestPercent}%` : ""}`;
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
        const c = obj as Cluster;
        const inner = document.createElement("div");
        inner.className = "globe-cluster-inner";
        inner.innerHTML = `<span>${c.emoji}</span><b>${c.label}</b><small>증류소 ${c.count}</small>`;
        el.appendChild(inner);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectCluster(c);
        });
      }
      return el;
    },
    [personalized, selectDistillery, selectCluster, selected],
  );

  const topByMatch = useMemo(
    () =>
      personalized
        ? [...distilleries]
            .filter((d) => d.bestPercent !== null)
            .sort((a, b) => (b.bestPercent ?? 0) - (a.bestPercent ?? 0))
            .slice(0, 6)
        : [],
    [distilleries, personalized],
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
    </div>
  ) : (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="size-4 shrink-0" aria-hidden />
        <p className="text-sm">
          {zoomed
            ? "증류소 아이콘을 누르면 그곳의 병이 여기 나와요."
            : "나라나 지역을 누르면 가까이 날아가요. 그다음 증류소 아이콘을 눌러보세요."}
        </p>
      </div>
      {topByMatch.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">내 취향과 가까운 증류소</p>
          <ul className="space-y-1.5">
            {topByMatch.map((d) => (
              <li key={d.name}>
                <button
                  type="button"
                  onClick={() => selectDistillery(d)}
                  className="flex w-full items-center justify-between rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-left text-sm hover:border-amber-400/50"
                >
                  <span>
                    <span className="font-medium">{d.nameKo}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{d.country}</span>
                  </span>
                  <MatchBadge percent={d.bestPercent} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">둘러보기 좋은 곳</p>
          <ul className="space-y-1.5">
            {clusters
              .filter((c) => c.count >= 3)
              .sort((a, b) => b.count - a.count)
              .slice(0, 6)
              .map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => selectCluster(c)}
                    className="flex w-full items-center justify-between rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-left text-sm hover:border-amber-400/50"
                  >
                    <span>
                      {c.emoji} <span className="font-medium">{c.label}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">증류소 {c.count} · {c.bottles}병</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 bottom-[3.5rem] top-14 z-0 bg-[#120c08] sm:bottom-0"
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
          backgroundColor="rgba(18,12,8,1)"
          globeImageUrl="/textures/earth-dark.jpg"
          atmosphereColor="#d9a441"
          atmosphereAltitude={0.2}
          rendererConfig={{ preserveDrawingBuffer: true, antialias: true }}
          onGlobeReady={onReady}
          onZoom={(pov: { altitude: number }) => setAltitude(pov.altitude)}
          // 멀리서는 작은 점만 (분위기용), 가까이서는 아이콘이 대신해요
          pointsData={zoomed ? [] : distilleries}
          pointLat="lat"
          pointLng="lng"
          pointColor={(p: object) =>
            personalized ? matchColor((p as GlobeDistillery).bestPercent) : ORIGIN_COLORS[(p as GlobeDistillery).origin]
          }
          pointAltitude={0.004}
          pointRadius={0.16}
          pointsMerge={true}
          htmlElementsData={zoomed ? distilleries : clusters}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={zoomed ? 0.01 : 0.03}
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
          {distilleries.length}곳의 증류소. 나라를 누르고, 가까이 가서 증류소 아이콘을 눌러보세요.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveView(v.id);
                setSelected(null);
                flyTo(v.lat, v.lng, v.altitude);
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
        <span className="rounded-full bg-black/40 px-2 py-0.5">{zoomed ? "증류소 보기" : "나라·지역 보기 · 스크롤로 확대"}</span>
      </div>

      {/* 우측: 정보 패널 (데스크톱) */}
      <aside className="glass absolute right-5 top-5 hidden max-h-[calc(100%-2.5rem)] w-96 overflow-y-auto rounded-2xl p-5 sm:block">
        {panel}
      </aside>

      {/* 모바일: 하단 시트 */}
      <div className="glass absolute inset-x-3 bottom-3 max-h-[46vh] overflow-hidden rounded-2xl sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
        >
          <span>{selected ? selected.nameKo : personalized ? "내 취향과 가까운 증류소" : "둘러보기"}</span>
          {sheetOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
        {sheetOpen && <div className="max-h-[38vh] overflow-y-auto px-4 pb-4">{panel}</div>}
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
