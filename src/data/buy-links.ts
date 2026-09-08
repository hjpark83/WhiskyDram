import type { Whisky } from "@/lib/whisky/types";

/**
 * "이 병 어디서 사요?" 에 대한 답.
 *
 * ## 왜 쇼핑몰 링크가 없나요
 *
 * 한국은 **주류 통신판매가 원칙적으로 금지**예요. 그래서 위스키를 장바구니에
 * 담아 집으로 받는 사이트는 (전통주를 빼면) 없어요. 있는 것처럼 이어주면
 * 거짓말이 돼요.
 *
 * 다만 2020년에 **스마트오더**가 허용됐어요. 앱에서 주문·결제하고 **매장에
 * 직접 가서 대면으로 받는** 방식이에요. 배달은 여전히 금지고요. 그래서 여기서
 * 이어주는 건 두 가지뿐이에요.
 *
 *  1. 스마트오더 앱 — 실제로 사서 픽업할 수 있는 합법 경로
 *  2. 검색·정보 링크 — 취급하는 매장이나 시세를 찾아보는 용도
 *
 * ## 남의 사이트를 긁지 않아요
 *
 * 가격을 크롤링해 오지 않고 **검색 주소만 만들어서 이어줘요**. 그 사이트의
 * 데이터는 그 사이트 것이고, 우리 시세는 사용자 제보(`/price`)로 모아요.
 */

export type BuyLinkKind = "smart_order" | "search" | "reference";

export interface BuyLink {
  kind: BuyLinkKind;
  label: string;
  /** 이게 뭐 하는 곳인지 한 줄 — 처음 보는 사람이 헷갈리지 않게 */
  hint: string;
  url: string;
}

export const BUY_LINK_KIND_LABELS: Record<BuyLinkKind, string> = {
  smart_order: "주문 후 매장에서 받기",
  search: "파는 곳 찾아보기",
  reference: "이 병에 대해 더 알아보기",
};

/** 스마트오더가 뭔지 모르는 사람이 대부분이라 화면에 같이 적어요 */
export const SMART_ORDER_NOTE =
  "앱에서 주문·결제하고 매장에 직접 가서 받는 방식이에요. 한국은 술 배달이 금지라 집으로는 못 받아요.";

function q(text: string): string {
  return encodeURIComponent(text);
}

/**
 * 검색어. 한글 이름이 안 잡히는 병이 많아서 영문 이름을 같이 넣어요.
 * 숙성 연수는 이름에 이미 들어 있는 경우가 많아 따로 붙이지 않아요.
 */
function searchTerm(w: Whisky): string {
  return w.nameKo === w.name ? w.name : `${w.nameKo} ${w.name}`;
}

export function buyLinks(w: Whisky): BuyLink[] {
  const term = searchTerm(w);
  const links: BuyLink[] = [
    {
      kind: "smart_order",
      label: "데일리샷에서 찾기",
      hint: "위스키 스마트오더 앱이에요. 근처 매장 재고와 가격을 보고 주문한 뒤 가서 받아요.",
      url: `https://dailyshot.co/search?q=${q(term)}`,
    },
    {
      kind: "search",
      label: "근처 주류 전문점 찾기",
      hint: "지도에서 리쿼샵을 찾아 전화로 재고를 물어보는 게 제일 확실해요.",
      url: `https://map.naver.com/p/search/${q("위스키 전문점")}`,
    },
    {
      kind: "search",
      label: "네이버에서 시세 보기",
      hint: "판매 글이 아니라 참고용이에요. 실제 매장 가격은 아래 제보 시세를 봐주세요.",
      url: `https://search.naver.com/search.naver?query=${q(`${term} 가격`)}`,
    },
  ];

  // 한정판은 매장에서 못 구해요. 파는 곳을 찾으라고 하면 헛걸음이라,
  // 어떤 병인지 확인할 수 있는 자료 쪽으로 안내해요.
  if (w.limited) {
    return [
      {
        kind: "reference",
        label: "Whiskybase 에서 이 병 보기",
        hint: "한정판이라 매장에서는 구하기 어려워요. 어떤 병인지·다른 사람 평가는 여기서 볼 수 있어요.",
        url: `https://www.whiskybase.com/search?q=${q(w.name)}`,
      },
      ...links.filter((l) => l.kind !== "smart_order"),
    ];
  }

  return links;
}
