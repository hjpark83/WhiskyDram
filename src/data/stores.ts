/**
 * 시세 제보에 쓰는 매장 목록.
 *
 * 자유 입력으로 두면 "트레이더스" / "이마트 트레이더스" / "트레이더스 월평점" 이
 * 다 다른 값이 되어 시세가 안 모여요. 그래서 큰 분류는 고르게 하고, 지점은
 * 따로 적게 해요.
 *
 * 온라인 링크가 없는 이유: 한국은 주류 통신판매가 원칙적으로 금지라
 * 마트·매장이 위스키 가격을 웹에 올리지 않아요. 그래서 이어줄 페이지가 없어요.
 */

export type StoreKind = "warehouse" | "mart" | "bottle_shop" | "duty_free" | "other";

export interface Store {
  id: string;
  label: string;
  kind: StoreKind;
  /** 매장 성격 한 줄 — 처음 보는 사람용 */
  hint?: string;
}

export const STORES: Store[] = [
  {
    id: "traders",
    label: "이마트 트레이더스",
    kind: "warehouse",
    hint: "창고형. 위스키 종류가 많고 가격이 낮은 편이에요.",
  },
  {
    id: "costco",
    label: "코스트코",
    kind: "warehouse",
    hint: "회원제 창고형. 1L 병이 많아서 용량을 꼭 확인해주세요.",
  },
  {
    id: "joyang",
    label: "조양마트",
    kind: "bottle_shop",
    hint: "서울 후암동. 애호가들이 많이 찾는 주류 전문점이에요.",
  },
  { id: "emart", label: "이마트", kind: "mart" },
  { id: "homeplus", label: "홈플러스", kind: "mart" },
  { id: "lotte_mart", label: "롯데마트", kind: "mart" },
  { id: "bottle_shop", label: "동네 주류샵", kind: "bottle_shop" },
  { id: "duty_free", label: "면세점", kind: "duty_free", hint: "입국장·기내 포함" },
  { id: "other", label: "그 외", kind: "other" },
];

export const STORE_LABELS_KO: Record<string, string> = Object.fromEntries(
  STORES.map((s) => [s.id, s.label]),
);

export function getStore(id: string): Store | undefined {
  return STORES.find((s) => s.id === id);
}

/** 흔한 용량. 코스트코는 1L 가 많아서 비교할 때 환산이 필요해요. */
export const VOLUMES_ML = [375, 500, 700, 750, 1000] as const;
