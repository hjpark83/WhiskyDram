import type { Region, Whisky, WhiskyType } from "@/lib/whisky/types";

export const TYPE_LABELS_KO: Record<WhiskyType, string> = {
  single_malt: "싱글몰트 스카치",
  blended_scotch: "블렌디드 스카치",
  bourbon: "버번 (미국)",
  rye: "라이 (미국)",
  irish: "아이리시",
  japanese: "재패니즈",
  other: "기타",
};

export const TYPE_SHORT_KO: Record<WhiskyType, string> = {
  single_malt: "싱글몰트",
  blended_scotch: "블렌디드",
  bourbon: "버번",
  rye: "라이",
  irish: "아이리시",
  japanese: "재패니즈",
  other: "기타",
};

export const REGION_LABELS_KO: Record<Region, string> = {
  Speyside: "스페이사이드",
  Highland: "하이랜드",
  Islay: "아일라",
  Lowland: "로우랜드",
  Campbeltown: "캠벨타운",
  Islands: "아일랜즈",
  Kentucky: "켄터키",
  Tennessee: "테네시",
  Ireland: "아일랜드",
  Japan: "일본",
  Other: "기타",
};

export const DIFFICULTY_LABELS_KO: Record<Whisky["difficulty"], string> = {
  1: "완전 입문",
  2: "입문",
  3: "중급",
  4: "개성 강함",
  5: "상급자용",
};

export function formatKrw(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}만 원`;
  }
  return `${n.toLocaleString("ko-KR")}원`;
}

export function formatPriceRange([min, max]: Whisky["priceKrw"]): string {
  return `${formatKrw(min)} ~ ${formatKrw(max)}`;
}

export function formatAge(age: number | null): string {
  return age === null ? "숙성 연수 미표기" : `${age}년`;
}

/** 지역 표시: 스카치는 지역, 그 외는 나라 */
export function formatOrigin(w: Whisky): string {
  if (w.region === "Other") return w.country;
  return `${w.country} · ${REGION_LABELS_KO[w.region]}`;
}
