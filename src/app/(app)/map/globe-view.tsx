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

const ORIGIN_COLORS: Record<Origin, string> = {
  scotch: "#f0c96a",
  irish: "#4ade80",
  japanese: "#f87171",
  american: "#60a5fa",
  korean: "#f472b6",
  other: "#c4b5fd",
};

const VIEWS: { id: string; label: string; lat: number; lng: number; altitude: number }[] = [
  { id: "world", label: "전체", lat: 30, lng: 20, altitude: 2.4 },
  { id: "scotland", label: "스코틀랜드", lat: 57, lng: -4.2, altitude: 0.45 },
  { id: "islay", label: "아일라 섬", lat: 55.75, lng: -6.2, altitude: 0.18 },
  { id: "ireland", label: "아일랜드", lat: 53.3, lng: -7.5, altitude: 0.5 },
  { id: "kentucky", label: "켄터키", lat: 37.9, lng: -85.2, altitude: 0.5 },
  { id: "japan", label: "일본", lat: 36.5, lng: 137.5, altitude: 0.9 },
  { id: "korea", label: "한국", lat: 37.6, lng: 127.1, altitude: 0.5 },
];

function matchColor(percent: number | null): string {
  if (percent === null) return "#a8a29e";
  if (percent >= 75) return "#f5b73a";
  if (percent >= 60) return "#e8c66f";
  if (percent >= 45) return "#c9b48a";
  return "#6b6258";
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<GlobeDistillery | null>(null);
  const [activeView, setActiveView] = useState("world");
  const [altitude, setAltitude] = useState(2.2);
  const [sheetOpen, setSheetOpen] = useState(true); // 모바일 하단 시트 펼침
  const baseRadius = Math.max(0.06, Math.min(0.3, altitude * 0.14));

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

  const flyTo = useCallback((lat: number, lng: number, altitude: number, ms = 900) => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = false;
    g.pointOfView({ lat, lng, altitude }, ms);
  }, []);

  const onReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const c = g.controls();
    c.autoRotate = true;
    c.autoRotateSpeed = 0.45;
    c.enableZoom = true;
    g.pointOfView({ lat: 40, lng: -10, altitude: 2.1 }, 0);
  }, []);

  const onPointClick = useCallback(
    (point: object) => {
      const d = point as GlobeDistillery;
      setSelected(d);
      setActiveView("");
      setSheetOpen(true);
      // 패널이 오른쪽에 뜨니 살짝 왼쪽으로 치우쳐 보이게
      flyTo(d.lat, d.lng + 4, 0.4);
    },
    [flyTo],
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

  const pointColor = useCallback(
    (point: object) => {
      const d = point as GlobeDistillery;
      if (selected && selected.name === d.name) return "#ffffff";
      return personalized ? matchColor(d.bestPercent) : ORIGIN_COLORS[d.origin];
    },
    [personalized, selected],
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
          <h2 className="mt-2 text-2xl font-bold text-amber-100">{selected.nameKo}</h2>
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
        <p className="text-sm">점을 누르면 그 증류소의 병이 여기 나와요. 드래그로 돌리고, 스크롤로 확대.</p>
      </div>
      {topByMatch.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">내 취향과 가까운 증류소</p>
          <ul className="space-y-1.5">
            {topByMatch.map((d) => (
              <li key={d.name}>
                <button
                  type="button"
                  onClick={() => onPointClick(d)}
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
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>· <b className="text-foreground">아일라 섬</b>: 연기 향의 성지, 작은 섬에 증류소 9곳</li>
            <li>· <b className="text-foreground">스페이사이드</b>: 강 하나에 증류소 50곳, 과일·꿀 향</li>
            <li>· <b className="text-foreground">켄터키</b>: 버번의 고향, 옥수수와 새 오크통</li>
            <li>· <b className="text-foreground">한국</b>: 남양주·김포에서 시작된 한국 싱글몰트</li>
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
          pointsData={distilleries}
          pointLat="lat"
          pointLng="lng"
          pointColor={pointColor}
          pointAltitude={(p: object) => Math.min(0.035, 0.01 + (p as GlobeDistillery).whiskies.length * 0.0025)}
          pointRadius={(p: object) =>
            selected && selected.name === (p as GlobeDistillery).name ? baseRadius * 1.8 : baseRadius
          }
          onZoom={(pov: { altitude: number }) => setAltitude(pov.altitude)}
          pointsMerge={false}
          pointLabel={(p: object) => {
            const d = p as GlobeDistillery;
            const pct = d.bestPercent !== null ? ` · 취향 ${d.bestPercent}%` : "";
            return `<div style="background:rgba(26,18,12,.92);color:#f3e7d3;padding:6px 10px;border-radius:8px;font-size:12px;border:1px solid rgba(217,164,65,.5)"><b>${d.nameKo}</b><br/>${d.country} · ${d.whiskies.length}병${pct}</div>`;
          }}
          onPointClick={onPointClick}
        />
      )}

      {/* 좌상단: 제목 + 빠른 이동 */}
      <div className="glass pointer-events-auto absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-2xl p-3 sm:left-5 sm:top-5 sm:max-w-md sm:p-4">
        <h1 className="text-lg font-bold text-amber-100 sm:text-xl">증류소 지도</h1>
        <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
          {distilleries.length}곳의 증류소.{" "}
          {personalized ? "점 색이 진할수록 내 취향과 잘 맞아요." : "취향 진단을 하면 점 색이 적합도로 바뀌어요."}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveView(v.id);
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
