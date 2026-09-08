/**
 * 시세 제보에 쓰는 매장 목록.
 *
 * 자유 입력으로 두면 "트레이더스" / "이마트 트레이더스" / "트레이더스 월평점" 이
 * 다 다른 값이 되어 시세가 안 모여요. 그래서 큰 분류는 고르게 하고, 지점은
 * 따로 적게 해요.
 *
 * 개별 매장 이름(예: 특정 주류샵)은 넣지 않아요. 한 곳만 이름을 박으면 그 가게
 * 홍보처럼 보이고, 다른 지역 사람은 고를 게 없어요. 전국 체인만 이름을 쓰고
 * 나머지는 **유형**(대형마트 · 리쿼샵 · 동네 마트)으로 묶어요.
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
    id: "mart",
    label: "대형마트",
    kind: "mart",
    hint: "이마트·홈플러스·롯데마트 등. 지점 이름은 아래 칸에 적어주세요.",
  },
  {
    id: "liquor_shop",
    label: "주류 전문점 (리쿼샵)",
    kind: "bottle_shop",
    hint: "위스키를 전문으로 파는 곳. 종류가 많고 시세 폭이 커요.",
  },
  {
    id: "local_mart",
    label: "동네 마트·슈퍼",
    kind: "mart",
    hint: "가게마다 가격이 제각각이라 지점 이름을 적어주시면 도움이 돼요.",
  },
  { id: "duty_free", label: "면세점", kind: "duty_free", hint: "입국장·기내 포함" },
  { id: "other", label: "그 외", kind: "other" },
];

/**
 * 예전에 쓰던 매장 id. 이미 올라온 제보가 이름 없이 뜨지 않게 남겨둬요.
 * 새 제보에서는 고를 수 없어요 (STORES 에 없으니까요).
 */
const LEGACY_STORE_LABELS: Record<string, string> = {
  joyang: "주류 전문점 (리쿼샵)",
  emart: "대형마트",
  homeplus: "대형마트",
  lotte_mart: "대형마트",
  bottle_shop: "주류 전문점 (리쿼샵)",
};

export const STORE_LABELS_KO: Record<string, string> = {
  ...LEGACY_STORE_LABELS,
  ...Object.fromEntries(STORES.map((s) => [s.id, s.label])),
};

export function getStore(id: string): Store | undefined {
  return STORES.find((s) => s.id === id);
}

/** 흔한 용량. 코스트코는 1L 가 많아서 비교할 때 환산이 필요해요. */
export const VOLUMES_ML = [375, 500, 700, 750, 1000] as const;
