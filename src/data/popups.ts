/**
 * 브랜드 팝업 스토어 정보.
 *
 * 팝업은 계속 바뀌는 정보라서 **관리자가 사이트에서 직접 등록**하는 게 원칙이에요
 * (Supabase `popup_stores` 테이블 · /admin/popups). 아래 목록은 DB가 비어 있을 때
 * 화면을 채워주는 예시 시드고, `sample: true` 로 표시돼서 UI에 "예시" 배지가 붙어요.
 *
 * 캐치테이블·네이버는 공개 API가 없어서 크롤링하지 않아요. 대신
 *  - 관리자가 넣은 예약/상세 링크를 그대로 이어주고,
 *  - 링크가 없으면 네이버·인스타그램 검색 링크를 자동으로 만들어 줘요.
 */

export type PopupLinkKind = "catchtable" | "naver" | "instagram" | "official" | "map";

export interface PopupLink {
  kind: PopupLinkKind;
  label: string;
  url: string;
}

export type PopupReservation = "catchtable" | "naver" | "instagram" | "walkin";

export interface PopupStore {
  id: string;
  /** 브랜드 (한글 표기) */
  brand: string;
  brandEn: string;
  title: string;
  /** 한 줄 요약 */
  summary: string;
  /** 어떤 내용인지 (2~4문장) */
  description: string;
  /** 가서 뭘 할 수 있는지 */
  highlights: string[];
  venue: string;
  address: string;
  city: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  hours: string;
  /** 입장료·예약 조건 */
  entry: string;
  reservation: PopupReservation;
  links: PopupLink[];
  /** 사전에 있는 관련 위스키 id */
  whiskyIds: string[];
  tags: string[];
  /** 카드 강조색 */
  accent: string;
  /** 예시 데이터인지 (실제 진행 정보는 관리자가 등록) */
  sample: boolean;
}

export const RESERVATION_LABELS_KO: Record<PopupReservation, string> = {
  catchtable: "캐치테이블 예약",
  naver: "네이버 예약",
  instagram: "인스타그램 DM 예약",
  walkin: "예약 없이 방문",
};

export const LINK_LABELS_KO: Record<PopupLinkKind, string> = {
  catchtable: "캐치테이블",
  naver: "네이버",
  instagram: "인스타그램",
  official: "공식 사이트",
  map: "지도",
};

/**
 * DB가 비어 있을 때 보여주는 예시 팝업.
 * 기간·장소는 실제 발표된 정보가 아니라 화면 확인용 예시예요.
 */
export const SEED_POPUPS: PopupStore[] = [
  {
    id: "sample-johnnie-walker-blue-lounge",
    brand: "조니 워커",
    brandEn: "Johnnie Walker",
    title: "조니 워커 블루 라벨 테이스팅 라운지",
    summary: "블루 라벨을 잔으로 맛보고, 하이볼로도 비교해보는 라운지형 팝업",
    description:
      "블렌디드 위스키가 어떻게 만들어지는지 원액 4종을 차례로 맛보면서 알아보는 프로그램이에요. 마지막에 블루 라벨을 스트레이트와 하이볼 두 잔으로 비교해요. 위스키를 처음 마셔보는 사람도 잔 잡는 법부터 알려줘서 부담이 없어요.",
    highlights: [
      "원액 4종 → 블렌딩 완성품까지 순서대로 시음",
      "같은 술을 스트레이트 / 하이볼로 비교",
      "이름을 새겨주는 각인 서비스",
    ],
    venue: "성수 편집숍 2층 라운지",
    address: "서울 성동구 성수동2가",
    city: "서울",
    startDate: "2026-08-20",
    endDate: "2026-09-28",
    hours: "13:00 – 21:00 (월 휴무)",
    entry: "3만원 · 시음 4종 + 하이볼 1잔 포함",
    reservation: "catchtable",
    links: [{ kind: "official", label: "조니 워커 공식", url: "https://www.johnniewalker.com/" }],
    whiskyIds: ["johnnie-walker-blue", "johnnie-walker-black", "johnnie-walker-green-15"],
    tags: ["시음", "하이볼", "블렌디드"],
    accent: "#3d6ea8",
    sample: true,
  },
  {
    id: "sample-balvenie-craft-bar",
    brand: "발베니",
    brandEn: "The Balvenie",
    title: "발베니 크래프트 바 — 손으로 만드는 것들",
    summary: "직접 만드는 워크숍과 12년 더블우드 시음을 함께",
    description:
      "발베니는 아직도 보리를 직접 띄우고 나무통을 손으로 짜는 증류소예요. 그 '수작업' 이야기를 가죽 코스터·유리잔 각인 같은 공방 체험으로 옮겨 왔어요. 체험이 끝나면 12년 더블우드를 한 잔 내주고, 셰리 통이 맛을 어떻게 바꾸는지 설명해줘요.",
    highlights: [
      "가죽 코스터 또는 잔 각인 워크숍 (약 40분)",
      "12년 더블우드 · 14년 캐리비안 캐스크 비교 시음",
      "통 조각 만져보는 캐스크 코너",
    ],
    venue: "한남동 팝업 스페이스",
    address: "서울 용산구 한남동",
    city: "서울",
    startDate: "2026-09-01",
    endDate: "2026-10-12",
    hours: "12:00 – 20:00",
    entry: "2만 5천원 · 워크숍 재료비 포함",
    reservation: "naver",
    links: [{ kind: "official", label: "발베니 공식", url: "https://www.thebalvenie.com/" }],
    whiskyIds: ["balvenie-12-doublewood", "balvenie-14-caribbean-cask", "balvenie-17-doublewood"],
    tags: ["워크숍", "셰리", "시음"],
    accent: "#a8752f",
    sample: true,
  },
  {
    id: "sample-glenfiddich-stag-house",
    brand: "글렌피딕",
    brandEn: "Glenfiddich",
    title: "글렌피딕 스태그 하우스",
    summary: "12년부터 21년까지, 숙성 연수를 나란히 놓고 맛보는 전시형 팝업",
    description:
      "같은 증류소의 위스키가 오래 잠들수록 어떻게 달라지는지 12·15·18년을 나란히 놓고 비교해요. 사슴(스태그) 로고로 유명한 브랜드라 포토존과 굿즈도 사슴 테마예요. 시음은 소량 3종이라 술이 약한 사람도 괜찮아요.",
    highlights: [
      "12 · 15 · 18년 나란히 비교 시음",
      "솔레라 배트(숙성 통) 재현 전시",
      "사슴 테마 포토존과 한정 굿즈",
    ],
    venue: "청담 갤러리형 쇼룸",
    address: "서울 강남구 청담동",
    city: "서울",
    startDate: "2026-10-02",
    endDate: "2026-11-15",
    hours: "11:00 – 20:00",
    entry: "무료 입장 · 시음은 현장 선착순",
    reservation: "walkin",
    links: [{ kind: "official", label: "글렌피딕 공식", url: "https://www.glenfiddich.com/" }],
    whiskyIds: ["glenfiddich-12", "glenfiddich-15", "glenfiddich-18", "glenfiddich-21"],
    tags: ["전시", "무료", "숙성비교"],
    accent: "#2f7a52",
    sample: true,
  },
  {
    id: "sample-macallan-sherry-room",
    brand: "맥캘란",
    brandEn: "The Macallan",
    title: "맥캘란 셰리 룸",
    summary: "셰리 통 향을 코로 먼저 익히고 12년 두 종류를 비교해요",
    description:
      "셰리 오크와 더블 캐스크가 왜 맛이 다른지 향 시향지로 먼저 익히고, 12년 두 병을 나란히 맛봐요. 건포도·초콜릿 같은 향을 실제 재료로 맡아볼 수 있어서 '셰리'라는 말이 처음인 사람에게 특히 좋아요.",
    highlights: [
      "셰리 오크 vs 더블 캐스크 12년 비교",
      "향 재료 시향 코너 (건포도·오렌지·정향)",
      "셰리 통 안쪽을 볼 수 있는 절단 전시",
    ],
    venue: "서울숲 팝업 파빌리온",
    address: "서울 성동구 성수동1가",
    city: "서울",
    startDate: "2026-09-12",
    endDate: "2026-10-05",
    hours: "13:00 – 21:00",
    entry: "2만원 · 시음 2종 포함",
    reservation: "catchtable",
    links: [{ kind: "official", label: "맥캘란 공식", url: "https://www.themacallan.com/" }],
    whiskyIds: ["macallan-12-sherry-oak", "macallan-12-double-cask", "macallan-15-double-cask"],
    tags: ["셰리", "시음", "향"],
    accent: "#8a2f3a",
    sample: true,
  },
  {
    id: "sample-ardbeg-smoke-day",
    brand: "아드벡",
    brandEn: "Ardbeg",
    title: "아드벡 스모크 데이 부산",
    summary: "피트(연기) 위스키만 모아놓은 하루짜리 야외 행사",
    description:
      "연기 향이 강한 아일라 위스키를 바닷바람 맞으면서 마셔보는 행사예요. 10년·위비스티·우가달을 순서대로 놓고 연기 세기를 비교해요. 훈제 음식 부스가 함께 있어서 왜 피트 위스키와 바비큐가 어울리는지 바로 느낄 수 있어요.",
    highlights: ["아드벡 3종 연기 세기 비교", "훈제 음식 페어링 부스", "야외 라이브 DJ"],
    venue: "부산 영도 야외 데크",
    address: "부산 영도구",
    city: "부산",
    startDate: "2026-06-05",
    endDate: "2026-07-20",
    hours: "16:00 – 22:00",
    entry: "4만원 · 시음 3종 + 음식 쿠폰",
    reservation: "instagram",
    links: [{ kind: "official", label: "아드벡 공식", url: "https://www.ardbeg.com/" }],
    whiskyIds: ["ardbeg-10", "ardbeg-wee-beastie", "ardbeg-uigeadail"],
    tags: ["피트", "야외", "페어링"],
    accent: "#4c6b3a",
    sample: true,
  },
  {
    id: "sample-ki-one-korean-malt",
    brand: "기원",
    brandEn: "Ki One",
    title: "기원 — 한국에서 만든 싱글몰트",
    summary: "국내 증류소가 만든 싱글몰트를 스코틀랜드 위스키와 비교해요",
    description:
      "남양주에서 만드는 한국 싱글몰트 '기원'을 스코틀랜드 12년들과 나란히 맛보는 자리예요. 더운 나라에서 숙성하면 왜 빨리 익는지, 통을 작게 쓰는 이유가 뭔지 만드는 사람이 직접 설명해줘요.",
    highlights: ["기원 배치 시리즈 시음", "국산 vs 스코틀랜드 블라인드 비교", "증류소 사람과 대화"],
    venue: "을지로 위스키 바 협업 팝업",
    address: "서울 중구 을지로3가",
    city: "서울",
    startDate: "2026-09-05",
    endDate: "2026-09-30",
    hours: "18:00 – 24:00 (일 휴무)",
    entry: "3만 5천원 · 시음 4종",
    reservation: "naver",
    links: [],
    whiskyIds: ["ki-one-batch"],
    tags: ["한국 위스키", "블라인드", "시음"],
    accent: "#c0641a",
    sample: true,
  },
];
