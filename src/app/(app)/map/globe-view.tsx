"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { MapPin, X } from "lucide-react";
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
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
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
  scotch: "#f59e0b",
  irish: "#22c55e",
  japanese: "#ef4444",
  american: "#3b82f6",
  korean: "#ec4899",
  other: "#a78bfa",
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
  if (percent === null) return "#94a3b8";
  if (percent >= 75) return "#f59e0b";
  if (percent >= 60) return "#fbbf24";
  if (percent >= 45) return "#fde68a";
  return "#64748b";
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
  // 확대할수록 점을 작게 (가까이서 겹치지 않게), 멀리서는 크게
  const baseRadius = Math.max(0.06, Math.min(0.3, altitude * 0.14));

  // 컨테이너 크기에 맞춰 캔버스 크기 조정
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
    c.autoRotateSpeed = 0.5;
    c.enableZoom = true;
    g.pointOfView({ lat: 45, lng: -10, altitude: 2.2 }, 0);
  }, []);

  const onPointClick = useCallback(
    (point: object) => {
      const d = point as GlobeDistillery;
      setSelected(d);
      setActiveView("");
      flyTo(d.lat, d.lng, 0.35);
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveView(v.id);
                flyTo(v.lat, v.lng, v.altitude);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                activeView === v.id
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-border bg-card hover:border-amber-600/60",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div
          ref={containerRef}
          className="relative h-[60vh] min-h-[380px] overflow-hidden rounded-2xl bg-slate-950"
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
              backgroundColor="rgba(2,6,23,1)"
              globeImageUrl="/textures/earth-dark.jpg"
              atmosphereColor="#f59e0b"
              atmosphereAltitude={0.18}
              rendererConfig={{ preserveDrawingBuffer: true, antialias: true }}
              onGlobeReady={onReady}
              pointsData={distilleries}
              pointLat="lat"
              pointLng="lng"
              pointColor={pointColor}
              pointAltitude={(p: object) => 0.015 + (p as GlobeDistillery).whiskies.length * 0.006}
              pointRadius={(p: object) =>
                selected && selected.name === (p as GlobeDistillery).name
                  ? baseRadius * 1.8
                  : baseRadius
              }
              onZoom={(pov: { altitude: number }) => setAltitude(pov.altitude)}
              pointsMerge={false}
              pointLabel={(p: object) => {
                const d = p as GlobeDistillery;
                const pct = d.bestPercent !== null ? ` · 취향 ${d.bestPercent}%` : "";
                return `<div style="background:rgba(15,23,42,.92);color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;border:1px solid rgba(245,158,11,.5)"><b>${d.nameKo}</b><br/>${d.country} · ${d.whiskies.length}병${pct}</div>`;
              }}
              onPointClick={onPointClick}
            />
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
            {personalized ? (
              <>
                <Legend color="#f59e0b" label="75%+" />
                <Legend color="#fbbf24" label="60%+" />
                <Legend color="#fde68a" label="45%+" />
                <Legend color="#64748b" label="그 이하" />
              </>
            ) : (
              (Object.keys(ORIGIN_COLORS) as Origin[]).map((o) => (
                <Legend key={o} color={ORIGIN_COLORS[o]} label={ORIGIN_LABELS_KO[o]} />
              ))
            )}
          </div>
        </div>
      </div>

      <aside className="rounded-2xl border bg-card p-5">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{ORIGIN_LABELS_KO[selected.origin]}</Badge>
                  {selected.region !== "Other" && (
                    <Badge variant="outline">{REGION_LABELS_KO[selected.region]}</Badge>
                  )}
                  {selected.founded && <Badge variant="outline">{selected.founded}년 설립</Badge>}
                </div>
                <h2 className="mt-2 text-xl font-bold">{selected.nameKo}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected.name} · {selected.country}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="닫기"
              >
                <X className="size-4" />
              </button>
            </div>
            {selected.blurb && <p className="text-sm leading-relaxed">{selected.blurb}</p>}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                이 증류소의 위스키 {selected.whiskies.length}병
              </p>
              <ul className="space-y-2">
                {[...selected.whiskies]
                  .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.priceKrw[0] - b.priceKrw[0])
                  .map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/whisky/${w.id}`}
                        className="block rounded-lg border px-3 py-2 transition-colors hover:border-amber-600/60"
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
                          <p className="mt-1 text-xs text-amber-800">
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
              <MapPin className="size-4" aria-hidden />
              <p className="text-sm">지구본의 점을 눌러보세요. 드래그로 돌리고, 스크롤로 확대할 수 있어요.</p>
            </div>
            {topByMatch.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">내 취향과 가장 가까운 증류소</p>
                <ul className="space-y-1.5">
                  {topByMatch.map((d) => (
                    <li key={d.name}>
                      <button
                        type="button"
                        onClick={() => onPointClick(d)}
                        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:border-amber-600/60"
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
                <p className="mb-2 text-sm font-medium">둘러보기 좋은 곳</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>· <b className="text-foreground">아일라 섬</b>: 연기 향 위스키의 성지, 작은 섬에 증류소 9곳</li>
                  <li>· <b className="text-foreground">스페이사이드</b>: 강 하나에 증류소 50곳, 과일·꿀 향</li>
                  <li>· <b className="text-foreground">켄터키</b>: 버번의 고향, 옥수수와 새 오크통</li>
                  <li>· <b className="text-foreground">한국</b>: 남양주·김포에서 시작된 한국 싱글몰트</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
