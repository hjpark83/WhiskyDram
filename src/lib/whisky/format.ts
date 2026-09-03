import type { Origin, Region, StyleTag, Whisky, WhiskyType } from "@/lib/whisky/types";

export const TYPE_LABELS_KO: Record<WhiskyType, string> = {
  single_malt: "싱글몰트",
  blended_scotch: "블렌디드",
  bourbon: "버번",
  rye: "라이",
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

// ---------------------------------------------------------------------------
// 원산지 (country 에서 파생)
// ---------------------------------------------------------------------------

export const ORIGIN_ORDER: Origin[] = ["scotch", "irish", "japanese", "american", "other"];

export const ORIGIN_LABELS_KO: Record<Origin, string> = {
  scotch: "스카치",
  irish: "아이리시",
  japanese: "재패니즈",
  american: "아메리칸",
  other: "그 외",
};

export const ORIGIN_DESCRIPTIONS_KO: Record<Origin, string> = {
  scotch: "스코틀랜드. 위스키의 본고장. 지역마다 맛이 달라요 (스페이사이드는 과일·꿀, 아일라는 연기).",
  irish: "아일랜드. 대개 3번 증류해 아주 부드럽고 가벼워요.",
  japanese: "일본. 섬세하고 균형 잡힌 스타일. 하이볼 문화의 고향.",
  american: "미국. 버번·라이·테네시. 새 오크통을 써서 바닐라·캐러멜 단맛이 진해요.",
  other: "대만 등. 더운 기후에서 빨리 숙성돼 열대과일 향이 나기도 해요.",
};

export function getOrigin(w: Whisky): Origin {
  switch (w.country) {
    case "스코틀랜드":
      return "scotch";
    case "아일랜드":
    case "북아일랜드":
      return "irish";
    case "일본":
      return "japanese";
    case "미국":
      return "american";
    default:
      return "other";
  }
}

// ---------------------------------------------------------------------------
// 스타일 태그
// ---------------------------------------------------------------------------

export const STYLE_ORDER: StyleTag[] = [
  "sherry",
  "peated",
  "bourbon_cask",
  "wine_cask",
  "high_proof",
  "highball",
];

export const STYLE_LABELS_KO: Record<StyleTag, string> = {
  sherry: "셰리 캐스크",
  peated: "피트",
  bourbon_cask: "버번 캐스크",
  wine_cask: "와인 캐스크",
  high_proof: "고도수",
  highball: "하이볼용",
};

export const STYLE_EMOJI: Record<StyleTag, string> = {
  sherry: "🍇",
  peated: "🔥",
  bourbon_cask: "🍯",
  wine_cask: "🍷",
  high_proof: "💪",
  highball: "🥤",
};

export const STYLE_DESCRIPTIONS_KO: Record<StyleTag, string> = {
  sherry: "셰리 와인을 담았던 통에서 숙성. 건포도·초콜릿 같은 진하고 달콤한 맛.",
  peated: "보리를 말릴 때 피트(이탄)를 태워 모닥불 같은 연기 향이 나요. 호불호가 갈려요.",
  bourbon_cask: "버번을 담았던 통에서 숙성. 바닐라·꿀 느낌에 가볍고 부드러워요.",
  wine_cask: "포트·레드와인 통에서 숙성. 베리 잼 같은 단맛과 붉은 과일 향.",
  high_proof: "알코올 50% 이상. 진하지만 물을 몇 방울 넣으면 향이 활짝 열려요.",
  highball: "탄산수에 섞어 마시기 좋은 가볍고 부담 없는 병. 첫 잔으로 안전해요.",
};
