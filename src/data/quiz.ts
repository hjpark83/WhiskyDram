import type { TasteAxis } from "@/lib/whisky/types";

/**
 * 취향 진단 질문.
 *
 * 각 선택지는 취향 축(-2..+2)에 더해지는 델타를 가져요.
 * 위스키 용어 없이 일상 경험만 물어보는 게 원칙.
 * `kind: "meta"` 질문은 예산·경험처럼 필터링에 쓰는 정보라 축 델타가 없어요.
 */

export type TasteDelta = Partial<Record<TasteAxis, number>>;

export interface QuizOption {
  id: string;
  label: string;
  emoji: string;
  delta?: TasteDelta;
  /**
   * 그 축을 **직접** 물어본 답. 정규화가 끝난 뒤 이 범위로 잘라요.
   *
   * 델타만 쓰면 간접 힌트가 직접 답을 지워버려요. "연기 냄새는 싫어요"(peat -2)
   * 를 골라도 "바다·소금 향"(peat +1)·"바닷가"(peat +1) 를 고르면 합이 0 이
   * 돼서 피트 위스키가 그대로 추천돼요. 바다 향이 좋다고 답한 게 연기가
   * 싫다는 답을 덮으면 안 되니까, 직접 물어본 답에 우선권을 줍니다.
   */
  decisive?: Partial<Record<TasteAxis, { min?: number; max?: number }>>;
}

export interface QuizQuestion {
  id: string;
  kind: "taste" | "budget" | "experience" | "scene";
  question: string;
  hint?: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "coffee",
    kind: "taste",
    question: "커피는 평소 어떻게 드세요?",
    hint: "쓴맛과 무게감에 대한 취향을 알아보는 질문이에요.",
    options: [
      {
        id: "americano",
        emoji: "☕",
        label: "진한 아메리카노, 쓴맛도 좋아요",
        delta: { oak: 1, body: 1, sweet: -1 },
      },
      {
        id: "latte",
        emoji: "🥛",
        label: "라떼나 달달한 커피가 좋아요",
        delta: { sweet: 2, body: -1 },
      },
      {
        id: "espresso",
        emoji: "🫘",
        label: "에스프레소처럼 진하고 묵직한 게 좋아요",
        delta: { body: 2, oak: 1 },
      },
      {
        id: "tea",
        emoji: "🍵",
        label: "커피보다 차나 주스를 마셔요",
        delta: { floral: 1, fruit: 1, body: -1 },
      },
    ],
  },
  {
    id: "smoke",
    kind: "taste",
    question: "훈제 연어, 장작 바비큐, 캠프파이어 냄새… 이런 '불맛·연기 향'은 어때요?",
    hint: "위스키에는 '피트'라는 연기 향이 나는 종류가 있어요.",
    options: [
      {
        id: "love",
        emoji: "🔥",
        label: "완전 좋아요, 불맛은 못 참죠",
        delta: { peat: 2, body: 1 },
        decisive: { peat: { min: 1 } },
      },
      {
        id: "sometimes",
        emoji: "🍖",
        label: "가끔은 좋아요",
        delta: { peat: 1 },
      },
      {
        id: "meh",
        emoji: "😐",
        label: "별로 안 찾아요",
        delta: { peat: -1 },
        decisive: { peat: { max: -1 } },
      },
      {
        id: "hate",
        emoji: "🙅",
        label: "연기 냄새는 싫어요",
        delta: { peat: -2, body: -1 },
        decisive: { peat: { max: -2 } },
      },
    ],
  },
  {
    id: "medicinal",
    kind: "taste",
    question: "정로환, 소독약, 병원 냄새 같은 건 어때요?",
    hint: "연기 향이 아주 강한 위스키에서 이런 냄새가 나요. 연기는 괜찮아도 이건 못 견디는 분이 많아요.",
    options: [
      {
        id: "fine",
        emoji: "😌",
        label: "별로 안 거슬려요",
        delta: { peat: 1 },
      },
      {
        id: "soso",
        emoji: "😐",
        label: "좋지도 싫지도 않아요",
      },
      {
        id: "no",
        emoji: "🤢",
        label: "그 냄새는 정말 싫어요",
        delta: { peat: -2 },
        decisive: { peat: { max: -1 } },
      },
    ],
  },
  {
    id: "dessert",
    kind: "taste",
    question: "디저트를 고른다면?",
    options: [
      {
        id: "chocolate",
        emoji: "🍫",
        label: "초콜릿·캐러멜·티라미수",
        delta: { sweet: 2, oak: 1 },
      },
      {
        id: "fruit",
        emoji: "🍓",
        label: "생과일·과일 타르트",
        delta: { fruit: 2, sweet: 1 },
      },
      {
        id: "cheese",
        emoji: "🧀",
        label: "치즈·견과류 같은 짭짤한 쪽",
        delta: { oak: 2, sweet: -1 },
      },
      {
        id: "none",
        emoji: "🚫",
        label: "디저트는 잘 안 먹어요",
        delta: { sweet: -2 },
      },
    ],
  },
  {
    id: "spice",
    kind: "taste",
    question: "매운 음식이나 향신료가 강한 음식은?",
    options: [
      {
        id: "love",
        emoji: "🌶️",
        label: "마라·불닭도 즐겨요",
        delta: { spice: 2, body: 1 },
        decisive: { spice: { min: 1 } },
      },
      {
        id: "moderate",
        emoji: "🍛",
        label: "적당히 매운 건 좋아요",
        delta: { spice: 1 },
      },
      {
        id: "mild",
        emoji: "🍚",
        label: "순한 음식이 좋아요",
        delta: { spice: -2, body: -1 },
        decisive: { spice: { max: -1 } },
      },
    ],
  },
  {
    id: "scent",
    kind: "taste",
    question: "이 중에 가장 끌리는 향은?",
    hint: "향수나 방향제를 고를 때를 떠올려보세요.",
    options: [
      {
        id: "floral",
        emoji: "🌸",
        label: "꽃·풀·비누 같은 산뜻한 향",
        delta: { floral: 2, body: -1 },
      },
      {
        id: "vanilla",
        emoji: "🍞",
        label: "바닐라·갓 구운 빵 같은 달콤한 향",
        delta: { sweet: 2 },
      },
      {
        id: "wood",
        emoji: "📚",
        label: "나무·가죽·오래된 책 같은 묵직한 향",
        delta: { oak: 2, body: 1 },
      },
      {
        id: "sea",
        emoji: "🌊",
        label: "바다·소금 같은 짭짤한 향",
        delta: { peat: 1, spice: 1 },
      },
    ],
  },
  {
    id: "nuts",
    kind: "taste",
    question: "견과류는 어떠세요?",
    hint: "오크통에서 오래 숙성된 위스키는 견과·나무 향이 나요.",
    options: [
      { id: "love", emoji: "🥜", label: "아몬드·호두 자주 먹어요", delta: { oak: 2, body: 1 } },
      { id: "ok", emoji: "🌰", label: "있으면 먹는 정도", delta: { oak: 1 } },
      { id: "no", emoji: "🙅", label: "잘 안 먹어요", delta: { oak: -1, fruit: 1 } },
    ],
  },
  {
    id: "ginger",
    kind: "taste",
    question: "수정과나 진저에일처럼 생강·계피 맛은?",
    hint: "위스키에서 '스파이시'라고 부르는 느낌이에요. 맵다기보다 알싸해요.",
    options: [
      { id: "love", emoji: "🫚", label: "알싸한 그 맛이 좋아요", delta: { spice: 2 } },
      { id: "ok", emoji: "🥤", label: "가끔 마셔요", delta: { spice: 1 } },
      { id: "no", emoji: "😖", label: "그 향은 부담스러워요", delta: { spice: -2, sweet: 1 } },
    ],
  },
  {
    id: "place",
    kind: "taste",
    question: "여행 간다면 어디로 가고 싶으세요?",
    hint: "바닷가 근처 증류소는 짭짤하고 연기 나는 위스키를 만들어요.",
    options: [
      { id: "sea", emoji: "🏖️", label: "파도 소리 들리는 바닷가", delta: { peat: 1, spice: 1, body: 1 } },
      { id: "forest", emoji: "🌲", label: "조용한 숲속", delta: { floral: 2, oak: 1 } },
      { id: "orchard", emoji: "🍎", label: "과수원·시골 마을", delta: { fruit: 2, sweet: 1 } },
      { id: "city", emoji: "🏙️", label: "도시 야경", delta: { sweet: 1, body: -1 } },
    ],
  },
  {
    id: "drink_style",
    kind: "taste",
    question: "위스키를 마신다면 어떻게 마실 것 같으세요?",
    hint: "몰라도 괜찮아요. 아래에서 끌리는 걸 고르시면 돼요.",
    options: [
      { id: "neat", emoji: "🥃", label: "잔에 그대로, 향을 천천히", delta: { body: 2, oak: 1 } },
      { id: "rocks", emoji: "🧊", label: "얼음 넣어서 시원하게", delta: { body: 1 } },
      { id: "highball", emoji: "🥤", label: "탄산에 섞어 하이볼로", delta: { body: -2, fruit: 1, sweet: 1 } },
      { id: "unsure", emoji: "🤔", label: "아직 잘 모르겠어요" },
    ],
  },
  {
    id: "scene",
    kind: "scene",
    question: "주로 어떤 자리에서 마시게 될 것 같으세요?",
    hint: "자리에 따라 어울리는 병이 달라요.",
    options: [
      { id: "alone", emoji: "🛋️", label: "혼자 집에서 천천히" },
      { id: "friends", emoji: "🍻", label: "친구들과 왁자지껄" },
      { id: "meal", emoji: "🍽️", label: "밥이나 안주와 함께" },
      { id: "gift", emoji: "🎁", label: "선물할 병을 찾아요" },
    ],
  },
  {
    id: "citrus",
    kind: "taste",
    question: "레몬·자몽처럼 상큼하고 새콤한 맛은?",
    options: [
      { id: "love", emoji: "🍋", label: "상큼한 거 좋아해요", delta: { fruit: 2, floral: 1, body: -1 } },
      { id: "ok", emoji: "🙂", label: "보통이에요", delta: { fruit: 1 } },
      { id: "no", emoji: "😖", label: "신맛은 별로예요", delta: { fruit: -2, sweet: 1 } },
    ],
  },
  {
    id: "flower",
    kind: "taste",
    question: "꽃향기 나는 비누나 섬유유연제는 어때요?",
    hint: "가볍고 산뜻한 위스키에서 이런 향이 나요.",
    options: [
      { id: "love", emoji: "💐", label: "향긋해서 좋아요", delta: { floral: 2 } },
      { id: "ok", emoji: "🙂", label: "무난해요", delta: { floral: 1 } },
      { id: "no", emoji: "🙅", label: "인공적인 꽃향은 싫어요", delta: { floral: -2, oak: 1 } },
    ],
  },
  {
    id: "dried_fruit",
    kind: "taste",
    question: "건포도, 곶감, 말린 무화과 같은 건과일은?",
    hint: "셰리 통에서 숙성한 위스키가 딱 이 맛이에요.",
    options: [
      { id: "love", emoji: "🍇", label: "쫀득하고 달아서 좋아요", delta: { fruit: 2, sweet: 2, oak: 1, body: 1 } },
      { id: "ok", emoji: "🙂", label: "가끔 먹어요", delta: { fruit: 1, sweet: 1 } },
      { id: "no", emoji: "🙅", label: "말린 과일은 안 좋아해요", delta: { fruit: -1, sweet: -1 } },
    ],
  },
  {
    id: "strength",
    kind: "taste",
    question: "술은 도수가 센 편이 좋아요, 순한 편이 좋아요?",
    hint: "위스키는 보통 40도인데, 50도가 넘는 것도 있어요.",
    options: [
      { id: "strong", emoji: "🥵", label: "화끈하게 센 게 좋아요", delta: { body: 2, spice: 1, oak: 1 } },
      { id: "normal", emoji: "🙂", label: "적당한 게 좋아요" },
      { id: "light", emoji: "💧", label: "순하고 부드러운 게 좋아요", delta: { body: -2, spice: -1, sweet: 1 } },
    ],
  },
  {
    id: "experience",
    kind: "experience",
    question: "술은 평소 얼마나 드세요?",
    hint: "도수와 강도를 맞추기 위한 질문이에요.",
    options: [
      {
        id: "rare",
        emoji: "🧃",
        label: "거의 안 마셔요",
        delta: { body: -2, sweet: 1 },
      },
      {
        id: "beer_wine",
        emoji: "🍷",
        label: "맥주·와인 정도",
        delta: { body: -1 },
      },
      {
        id: "soju_highball",
        emoji: "🥂",
        label: "소주·하이볼 자주 마셔요",
      },
      {
        id: "whisky_some",
        emoji: "🥃",
        label: "위스키도 몇 번 마셔봤어요",
        delta: { body: 1 },
      },
    ],
  },
  {
    id: "budget",
    kind: "budget",
    question: "첫 병 예산은 어느 정도가 편하세요?",
    hint: "국내 마트·주류샵 기준 한 병 가격이에요.",
    options: [
      { id: "under5", emoji: "💸", label: "5만 원 이하" },
      { id: "5to10", emoji: "💵", label: "5~10만 원" },
      { id: "10to20", emoji: "💰", label: "10~20만 원" },
      { id: "any", emoji: "🎁", label: "상관없어요" },
    ],
  },
];

/** 예산 선택지 → 최대 가격 (원). null = 제한 없음 */
export const BUDGET_MAX_KRW: Record<string, number | null> = {
  under5: 50000,
  "5to10": 100000,
  "10to20": 200000,
  any: null,
};

/** 경험 선택지 → 허용되는 최대 난이도 (1~5) */
export const EXPERIENCE_MAX_DIFFICULTY: Record<string, 1 | 2 | 3 | 4 | 5> = {
  rare: 1,
  beer_wine: 2,
  soju_highball: 3,
  whisky_some: 4,
};

/** 퀴즈의 "어떤 자리" 답 → 내 정보의 마시는 상황(DrinkScene) */
export const SCENE_FROM_ANSWER: Record<string, string> = {
  alone: "alone",
  friends: "friends",
  meal: "meal",
  gift: "gift",
};

export type QuizAnswers = Record<string, string>; // questionId -> optionId
