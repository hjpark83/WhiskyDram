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

/**
 * 시세 검색은 구글로, **영문 이름으로** 물어봐요.
 *
 * 예전엔 네이버에 한글 이름으로 물어봤어요. 그러면 국내 블로그 글만 나와서
 * 두 가지가 빠졌어요 — **해외 판매점 가격**(Master of Malt·The Whisky Exchange·
 * Whiskybase 같은 곳)과, 국내에 아직 안 들어온 병이에요. 이 사전에는 국내에
 * 정식 수입되지 않은 병도 있어서(파리에서 마신 프렌치 위스키처럼) 한글 이름으로는
 * 검색 결과가 아예 안 나오는 경우가 있어요.
 *
 * 구글은 한국 페이지도 같이 물어와서 국내 시세를 잃지도 않아요.
 *
 * 영문 이름만 넣는 이유: 한글 이름을 같이 넣으면 검색어가 한국어 쪽으로
 * 쏠려서 해외 판매점이 다시 밀려요. 해외 가격을 보는 게 목적이니까 영문만요.
 *
 * `whisky` 를 붙이는 건 동명이인 때문이에요 — Macallan·Glenlivet 처럼
 * 지명이기도 한 이름이 많아서, 안 붙이면 관광 정보가 먼저 나와요.
 *
 * **해외 가격은 참고용이에요.** 한국은 개인이 주류를 국제 배송으로 들여올 수
 * 없어요 (주류 수입은 면허가 필요해요). 여행 중에 사거나 면세점에서 살 때,
 * 그리고 "이 병이 국내에서 비싸게 팔리는 건가" 를 가늠할 때 쓰는 값이에요.
 */
function googlePriceUrl(w: Whisky): string {
  return `https://www.google.com/search?q=${q(`${w.name} whisky price`)}`;
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
      label: "구글에서 시세 보기",
      hint: "해외 판매점 가격까지 같이 나와요. 국내 시세는 아래 제보 시세를, 실제 매장 가격은 데일리샷을 봐주세요.",
      url: googlePriceUrl(w),
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
