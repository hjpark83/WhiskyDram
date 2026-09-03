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
}

export interface QuizQuestion {
  id: string;
  kind: "taste" | "budget" | "experience";
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
      },
      {
        id: "hate",
        emoji: "🙅",
        label: "연기 냄새는 싫어요",
        delta: { peat: -2, body: -1 },
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

export type QuizAnswers = Record<string, string>; // questionId -> optionId
