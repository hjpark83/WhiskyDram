import { TASTE_AXES, EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";

/**
 * 공유 카드는 DB 없이 URL 파라미터만으로 그려요 (공개 정책·토큰 불필요).
 *   t = 취향 별명, p = 7축 값(csv), w = 위스키 id 3개(csv)
 */
export interface ShareData {
  title: string;
  profile: TasteProfile;
  whiskyIds: string[];
}

export function encodeShare(d: ShareData): string {
  const q = new URLSearchParams();
  q.set("t", d.title.slice(0, 20));
  q.set("p", TASTE_AXES.map((a) => d.profile[a] ?? 0).join(","));
  q.set("w", d.whiskyIds.slice(0, 3).join(","));
  return q.toString();
}

export function decodeShare(params: Record<string, string | string[] | undefined>): ShareData | null {
  const t = typeof params.t === "string" ? params.t : "";
  const p = typeof params.p === "string" ? params.p : "";
  const w = typeof params.w === "string" ? params.w : "";
  if (!t || !p) return null;
  const nums = p.split(",").map(Number);
  if (nums.length !== TASTE_AXES.length || nums.some((n) => Number.isNaN(n))) return null;
  const profile = { ...EMPTY_TASTE_PROFILE };
  TASTE_AXES.forEach((a, i) => {
    profile[a] = Math.max(-2, Math.min(2, nums[i]));
  });
  return {
    title: t.slice(0, 20),
    profile,
    whiskyIds: w ? w.split(",").filter(Boolean).slice(0, 3) : [],
  };
}
