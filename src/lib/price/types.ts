/** 시세 제보 한 건 */
export interface PriceReport {
  id: string;
  whiskyId: string;
  store: string;
  storeNote: string;
  priceKrw: number;
  volumeMl: number;
  /** 언제 본 가격인지 (YYYY-MM-DD) */
  seenOn: string;
  note: string;
  /** 제보한 사람 (본인 제보를 지울 수 있게) */
  userId: string;
}

/** 한 병의 시세 요약 */
export interface PriceSummary {
  whiskyId: string;
  count: number;
  /** 700ml 기준으로 환산한 중간값 — 이게 비교용 대표값이에요 */
  medianPer700: number;
  minPer700: number;
  maxPer700: number;
  /** 가장 최근 제보일 (YYYY-MM-DD) */
  latestSeenOn: string;
  /** 최근 90일 안에 들어온 제보 수 */
  freshCount: number;
  /** 매장별 요약 (제보가 많은 순) */
  byStore: StoreSummary[];
}

export interface StoreSummary {
  store: string;
  count: number;
  medianPer700: number;
  latestSeenOn: string;
}
