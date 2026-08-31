/**
 * Core domain types.
 *
 * Both the user's taste profile and each whisky's flavor profile share the same
 * axes so recommendation is a simple similarity score, and the review analyzer
 * can return deltas on the same axes.
 */

export const TASTE_AXES = [
  "peat", // 피트/스모키 — 모닥불, 소독약, 훈제
  "fruit", // 과일 — 사과, 배, 건포도, 열대과일
  "sweet", // 단맛 — 꿀, 바닐라, 캐러멜
  "spice", // 스파이시 — 후추, 계피, 생강
  "floral", // 꽃/풀 — 헤더, 풀잎, 허브
  "oak", // 오크/우디 — 나무, 견과류, 가죽
  "body", // 바디감 — 가벼움(0) ~ 묵직함(5)
] as const;

export type TasteAxis = (typeof TASTE_AXES)[number];

/** 0..5 intensity for a whisky */
export type FlavorProfile = Record<TasteAxis, number>;

/** -2..+2 preference for a user (0 = neutral / unknown) */
export type TasteProfile = Record<TasteAxis, number>;

export const AXIS_LABELS_KO: Record<TasteAxis, string> = {
  peat: "피트·스모키",
  fruit: "과일",
  sweet: "단맛",
  spice: "스파이시",
  floral: "꽃·풀",
  oak: "오크·견과",
  body: "바디감",
};

export type WhiskyType =
  | "single_malt"
  | "blended_scotch"
  | "bourbon"
  | "rye"
  | "irish"
  | "japanese"
  | "other";

export type Region =
  | "Speyside"
  | "Highland"
  | "Islay"
  | "Lowland"
  | "Campbeltown"
  | "Islands"
  | "Kentucky"
  | "Tennessee"
  | "Ireland"
  | "Japan"
  | "Other";

export interface Whisky {
  id: string; // slug, e.g. "glenmorangie-10"
  name: string; // English
  nameKo: string;
  distillery: string;
  region: Region;
  country: string;
  type: WhiskyType;
  abv: number;
  age: number | null; // null = NAS (No Age Statement)
  priceKrw: [min: number, max: number]; // 국내 대략적 소비자가 범위
  /** 1 = 입문용, 5 = 상급자용 */
  difficulty: 1 | 2 | 3 | 4 | 5;
  flavor: FlavorProfile;
  notes: { nose: string; palate: string; finish: string }; // 초보자 언어
  beginnerTip: string; // "이런 분께 좋아요 / 이런 점은 주의"
  pairings: string[]; // 안주·음식
  location: { lat: number; lng: number } | null;
  aliases?: string[]; // 라벨 인식 매칭용 (e.g. "Glenmorangie The Original")
}

export const EMPTY_TASTE_PROFILE: TasteProfile = {
  peat: 0,
  fruit: 0,
  sweet: 0,
  spice: 0,
  floral: 0,
  oak: 0,
  body: 0,
};
