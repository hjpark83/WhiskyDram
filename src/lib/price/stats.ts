import type { PriceReport, PriceSummary, StoreSummary } from "@/lib/price/types";

/**
 * 시세 계산.
 *
 * 두 가지 원칙:
 *  1) 용량이 다르면 가격을 비교할 수 없어요 (코스트코 1L vs 마트 700ml).
 *     그래서 전부 **700ml 기준으로 환산**해서 비교해요.
 *  2) 평균이 아니라 **중간값**을 써요. 면세점 한 건이나 오타 하나가
 *     전체 시세를 끌어당기면 안 되니까요.
 */

export const REFERENCE_ML = 700;

/** 700ml 기준 환산 가격 (100원 단위로 정리) */
export function per700(report: Pick<PriceReport, "priceKrw" | "volumeMl">): number {
  const ratio = REFERENCE_ML / Math.max(1, report.volumeMl);
  return Math.round((report.priceKrw * ratio) / 100) * 100;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** 제보가 오래되면 신뢰도가 떨어져요. 90일을 기준으로 봐요. */
export const FRESH_DAYS = 90;

export function daysSince(isoDate: string, now = new Date()): number {
  const then = new Date(`${isoDate}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export function isFresh(isoDate: string, now = new Date()): boolean {
  return daysSince(isoDate, now) <= FRESH_DAYS;
}

export function summarize(whiskyId: string, reports: PriceReport[], now = new Date()): PriceSummary | null {
  const mine = reports.filter((r) => r.whiskyId === whiskyId);
  if (mine.length === 0) return null;

  const prices = mine.map(per700);
  const stores = new Map<string, PriceReport[]>();
  for (const r of mine) {
    const list = stores.get(r.store) ?? [];
    list.push(r);
    stores.set(r.store, list);
  }

  const byStore: StoreSummary[] = [...stores.entries()]
    .map(([store, list]) => ({
      store,
      count: list.length,
      medianPer700: median(list.map(per700)),
      latestSeenOn: list.reduce((a, r) => (r.seenOn > a ? r.seenOn : a), list[0].seenOn),
    }))
    .sort((a, b) => b.count - a.count || b.latestSeenOn.localeCompare(a.latestSeenOn));

  return {
    whiskyId,
    count: mine.length,
    medianPer700: median(prices),
    minPer700: Math.min(...prices),
    maxPer700: Math.max(...prices),
    latestSeenOn: mine.reduce((a, r) => (r.seenOn > a ? r.seenOn : a), mine[0].seenOn),
    freshCount: mine.filter((r) => isFresh(r.seenOn, now)).length,
    byStore,
  };
}

/** 제보가 있는 병들을 한 번에 요약해요 */
export function summarizeAll(reports: PriceReport[], now = new Date()): PriceSummary[] {
  const ids = [...new Set(reports.map((r) => r.whiskyId))];
  return ids
    .map((id) => summarize(id, reports, now))
    .filter((s): s is PriceSummary => s !== null)
    .sort((a, b) => b.count - a.count || b.latestSeenOn.localeCompare(a.latestSeenOn));
}

/** 사전에 적힌 가격 범위와 비교해서 "싼가/비싼가"를 규칙으로 판단해요 */
export type PriceStance = "good" | "fair" | "high";

export function stanceFor(medianPer700Value: number, range: [number, number]): PriceStance {
  const [low, high] = range;
  if (medianPer700Value <= low) return "good";
  if (medianPer700Value >= high) return "high";
  return "fair";
}

export const STANCE_LABELS_KO: Record<PriceStance, string> = {
  good: "싸게 나온 편",
  fair: "보통 시세",
  high: "비싼 편",
};

export function formatKrw(value: number): string {
  if (value >= 10_000) {
    const man = value / 10_000;
    const text = Number.isInteger(man) ? `${man}` : man.toFixed(1);
    return `${text}만 원`;
  }
  return `${value.toLocaleString("ko-KR")}원`;
}

/** "3일 전", "2개월 전" 같은 표현 */
export function agoText(isoDate: string, now = new Date()): string {
  const days = daysSince(isoDate, now);
  if (!Number.isFinite(days)) return "날짜 미상";
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}
