import { REGION_LABELS_KO } from "@/lib/whisky/format";
import type { Region } from "@/lib/whisky/types";
import type { GlobeDistillery } from "./globe-view";

/**
 * 지구본을 3단계로 좁혀요: 나라 → 지역 → 증류소.
 * 스코틀랜드처럼 증류소가 몰린 곳은 마지막 단계에서도 줌에 맞춰 묶어서
 * 핀이 절대 겹치지 않게 해요 (겹치면 원하는 걸 누를 수 없으니까요).
 */

export type Level = "country" | "region" | "distillery";

/** 이 고도보다 멀면 나라 */
export const REGION_ZOOM = 1.15;
/** 이 고도보다 가까우면 증류소 핀 */
export const PIN_ZOOM = 0.34;

export function levelForAltitude(alt: number): Level {
  if (alt > REGION_ZOOM) return "country";
  if (alt > PIN_ZOOM) return "region";
  return "distillery";
}

/** 지구본 카메라의 시야각 (three-render-objects 기본값) */
const FOV_DEG = 50;

/**
 * 반경 `spreadDeg` 만큼의 범위가 화면에 꽉 차는 고도를 구해요.
 * 나라·지역마다 크기가 제각각이라(스코틀랜드 vs 미국) 고정값을 쓰면
 * 어떤 곳은 너무 멀고 어떤 곳은 너무 가까워요.
 */
export function altitudeForSpread(spreadDeg: number): number {
  const half = ((FOV_DEG / 2) * Math.PI) / 180;
  const target = ((Math.min(60, Math.max(0.15, spreadDeg * 1.35)) * Math.PI) / 180);
  const altitude = Math.sin(target + half) / Math.sin(half) - 1;
  return Math.max(0.02, Math.min(2.4, altitude));
}

/** 나라 이름 정리 (같은 나라로 볼 것들을 합쳐요) */
export const COUNTRY_MERGE: Record<string, string> = {
  북아일랜드: "아일랜드",
  웨일스: "영국",
  "영국(잉글랜드)": "영국",
};

export function countryKey(country: string): string {
  return COUNTRY_MERGE[country] ?? country;
}

export const COUNTRY_EMOJI: Record<string, string> = {
  스코틀랜드: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  아일랜드: "🇮🇪",
  미국: "🇺🇸",
  일본: "🇯🇵",
  한국: "🇰🇷",
  대만: "🇹🇼",
  인도: "🇮🇳",
  호주: "🇦🇺",
  영국: "🇬🇧",
  캐나다: "🇨🇦",
  프랑스: "🇫🇷",
  스웨덴: "🇸🇪",
  독일: "🇩🇪",
};

/** 나라·지역 묶음 (1·2단계 버블) */
export interface GroupNode {
  kind: "country" | "region";
  key: string;
  label: string;
  sublabel: string;
  emoji: string;
  country: string;
  region: Region | null;
  lat: number;
  lng: number;
  /** 눌렀을 때 날아갈 고도 */
  altitude: number;
  count: number;
  bottles: number;
  bestPercent: number | null;
}

function centroid(list: GlobeDistillery[]): { lat: number; lng: number; spread: number } {
  const lat = list.reduce((a, d) => a + d.lat, 0) / list.length;
  const lng = list.reduce((a, d) => a + d.lng, 0) / list.length;
  // 경도 1도는 위도가 높을수록 짧아요
  const k = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const spread = Math.max(...list.map((d) => Math.hypot(d.lat - lat, (d.lng - lng) * k)), 0.15);
  return { lat, lng, spread };
}

function best(list: GlobeDistillery[]): number | null {
  const ps = list.map((d) => d.bestPercent).filter((p): p is number => p !== null);
  return ps.length ? Math.max(...ps) : null;
}

function groupBy<T>(list: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** 지역 라벨: 스코틀랜드는 스페이사이드/아일라…, 그 외에는 켄터키·일본처럼 지역명 그대로 */
function regionLabel(country: string, region: Region): string {
  if (region === "Other") return countryKey(country);
  return REGION_LABELS_KO[region];
}

export function buildRegionGroups(distilleries: GlobeDistillery[]): GroupNode[] {
  const groups = groupBy(distilleries, (d) => `${countryKey(d.country)}/${d.region}`);
  return [...groups.entries()].map(([key, list]) => {
    const { lat, lng, spread } = centroid(list);
    const country = countryKey(list[0].country);
    return {
      kind: "region" as const,
      key,
      label: regionLabel(list[0].country, list[0].region),
      sublabel: country,
      emoji: COUNTRY_EMOJI[country] ?? "🥃",
      country,
      region: list[0].region,
      lat,
      lng,
      // 이 지역이 화면에 꽉 차는 고도
      altitude: altitudeForSpread(spread),
      count: list.length,
      bottles: list.reduce((a, d) => a + d.whiskies.length, 0),
      bestPercent: best(list),
    };
  });
}

export function buildCountryGroups(distilleries: GlobeDistillery[]): GroupNode[] {
  const regions = buildRegionGroups(distilleries);
  const groups = groupBy(distilleries, (d) => countryKey(d.country));
  return [...groups.entries()].map(([key, list]) => {
    const { lat, lng, spread } = centroid(list);
    const regionCount = regions.filter((r) => r.country === key).length;
    return {
      kind: "country" as const,
      key,
      label: key,
      sublabel: regionCount > 1 ? `지역 ${regionCount}곳` : "",
      emoji: COUNTRY_EMOJI[key] ?? "🥃",
      country: key,
      region: null,
      lat,
      lng,
      // 이 나라가 화면에 꽉 차는 고도 (지역 버블이 서로 떨어져 보이게)
      altitude: altitudeForSpread(spread),
      count: list.length,
      bottles: list.reduce((a, d) => a + d.whiskies.length, 0),
      bestPercent: best(list),
    };
  });
}

/** 3단계 핀: 하나면 증류소, 여러 개면 숫자 뱃지 */
export interface PinNode {
  key: string;
  lat: number;
  lng: number;
  items: GlobeDistillery[];
  bestPercent: number | null;
}

/**
 * 현재 고도에 맞춰 격자로 묶어요. 격자 칸은 화면에 보이는 범위에 비례하므로
 * 어느 배율에서도 핀 사이가 벌어져 있어요. 확대하면 칸이 작아지면서 저절로 흩어져요.
 */
export function clusterPins(distilleries: GlobeDistillery[], altitude: number): PinNode[] {
  const cell = Math.max(0.012, Math.min(0.9, altitude * 2.2));
  const groups = groupBy(distilleries, (d) => {
    // 경도는 위도가 높아질수록 촘촘해지므로 cos(lat) 로 보정해요
    const lngCell = cell / Math.max(0.25, Math.cos((d.lat * Math.PI) / 180));
    return `${Math.round(d.lat / cell)}:${Math.round(d.lng / lngCell)}`;
  });
  return [...groups.entries()].map(([key, items]) => {
    if (items.length === 1) {
      const d = items[0];
      return { key: d.name, lat: d.lat, lng: d.lng, items, bestPercent: d.bestPercent };
    }
    const { lat, lng } = centroid(items);
    return { key, lat, lng, items, bestPercent: best(items) };
  });
}

/** 검색: 한글 이름·영문 이름·나라·지역 어디든 걸리면 통과 */
export function searchDistilleries(
  distilleries: GlobeDistillery[],
  query: string,
  limit = 40,
): GlobeDistillery[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hit = (d: GlobeDistillery) =>
    d.nameKo.toLowerCase().includes(q) ||
    d.name.toLowerCase().includes(q) ||
    d.country.toLowerCase().includes(q) ||
    REGION_LABELS_KO[d.region].toLowerCase().includes(q) ||
    d.whiskies.some((w) => w.nameKo.toLowerCase().includes(q) || w.name.toLowerCase().includes(q));
  return distilleries
    .filter(hit)
    .sort((a, b) => {
      // 이름이 검색어로 시작하면 위로
      const as = a.nameKo.toLowerCase().startsWith(q) || a.name.toLowerCase().startsWith(q);
      const bs = b.nameKo.toLowerCase().startsWith(q) || b.name.toLowerCase().startsWith(q);
      if (as !== bs) return as ? -1 : 1;
      return (b.bestPercent ?? -1) - (a.bestPercent ?? -1) || a.nameKo.localeCompare(b.nameKo);
    })
    .slice(0, limit);
}
