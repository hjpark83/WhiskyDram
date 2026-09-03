import {
  BUDGET_MAX_KRW,
  EXPERIENCE_MAX_DIFFICULTY,
  QUIZ_QUESTIONS,
  type QuizAnswers,
} from "@/data/quiz";
import { WHISKIES } from "@/data/whiskies";
import {
  EMPTY_TASTE_PROFILE,
  TASTE_AXES,
  type TasteProfile,
  type Whisky,
} from "@/lib/whisky/types";

// ---------------------------------------------------------------------------
// 취향 프로필 계산
// ---------------------------------------------------------------------------

export function clampProfile(p: TasteProfile): TasteProfile {
  const out = { ...p };
  for (const axis of TASTE_AXES) {
    out[axis] = Math.max(-2, Math.min(2, Math.round(out[axis] ?? 0)));
  }
  return out;
}

/** 진단 답변 → 취향 프로필 (-2..+2) */
export function profileFromAnswers(answers: QuizAnswers): TasteProfile {
  const raw: TasteProfile = { ...EMPTY_TASTE_PROFILE };
  for (const q of QUIZ_QUESTIONS) {
    const optionId = answers[q.id];
    const option = q.options.find((o) => o.id === optionId);
    if (!option?.delta) continue;
    for (const [axis, d] of Object.entries(option.delta)) {
      raw[axis as keyof TasteProfile] += d ?? 0;
    }
  }
  // 여러 질문이 같은 축을 건드리니 합이 ±4까지 갈 수 있어요. 절반으로 눌러 -2..+2로.
  for (const axis of TASTE_AXES) {
    raw[axis] = raw[axis] / 2;
  }
  return clampProfile(raw);
}

/**
 * 후기 분석 델타(-2..+2)를 기존 프로필에 반영.
 * 한 번의 후기가 프로필을 뒤집지 않도록 절반 가중치로 더해요.
 */
export function applyDeltas(
  profile: TasteProfile,
  deltas: Partial<TasteProfile>,
  weight = 0.5,
): TasteProfile {
  const out = { ...EMPTY_TASTE_PROFILE, ...profile };
  for (const axis of TASTE_AXES) {
    const d = deltas[axis];
    if (typeof d === "number") out[axis] = out[axis] + d * weight;
  }
  return clampProfile(out);
}

export function hasProfile(profile: Partial<TasteProfile> | null | undefined) {
  if (!profile) return false;
  return TASTE_AXES.some((axis) => (profile[axis] ?? 0) !== 0);
}

// ---------------------------------------------------------------------------
// 점수 계산
// ---------------------------------------------------------------------------

/**
 * 취향(-2..+2) · 향미(0..5) 적합도.
 * 향미를 중앙(2.5) 기준으로 -2.5..+2.5 로 옮긴 뒤 내적. 범위는 대략 -35..+35.
 * 사용자가 신경 안 쓰는 축(0)은 자연스럽게 무시돼요.
 */
export function matchScore(profile: TasteProfile, whisky: Whisky): number {
  let score = 0;
  for (const axis of TASTE_AXES) {
    score += profile[axis] * (whisky.flavor[axis] - 2.5);
  }
  return score;
}

/** 0..100 로 보기 좋게 정규화한 적합도. 프로필이 비어 있으면 null. */
export function matchPercent(profile: TasteProfile, whisky: Whisky): number | null {
  if (!hasProfile(profile)) return null;
  // 이 프로필에서 가능한 최대 점수 = Σ |pref| * 2.5
  const max = TASTE_AXES.reduce((acc, a) => acc + Math.abs(profile[a]) * 2.5, 0);
  if (max === 0) return null;
  const s = matchScore(profile, whisky);
  return Math.round(((s / max + 1) / 2) * 100);
}

export interface CandidateFilters {
  maxPriceKrw?: number | null;
  maxDifficulty?: 1 | 2 | 3 | 4 | 5;
  excludeIds?: string[];
}

export function filtersFromAnswers(answers: QuizAnswers): CandidateFilters {
  return {
    maxPriceKrw: BUDGET_MAX_KRW[answers.budget] ?? null,
    maxDifficulty: EXPERIENCE_MAX_DIFFICULTY[answers.experience] ?? 3,
  };
}

export interface ScoredWhisky {
  whisky: Whisky;
  score: number;
  percent: number | null;
}

/**
 * 취향에 맞는 후보를 점수순으로 돌려줘요.
 * 예산·난이도 필터를 적용하되, 필터 결과가 너무 적으면 조건을 완화해요.
 */
export function rankWhiskies(
  profile: TasteProfile,
  filters: CandidateFilters = {},
  limit = 8,
): ScoredWhisky[] {
  const excluded = new Set(filters.excludeIds ?? []);
  const base = WHISKIES.filter((w) => !excluded.has(w.id));

  const strict = base.filter((w) => {
    if (filters.maxPriceKrw && w.priceKrw[0] > filters.maxPriceKrw) return false;
    if (filters.maxDifficulty && w.difficulty > filters.maxDifficulty) return false;
    return true;
  });

  // 후보가 너무 적으면 난이도 제한을 한 단계 풀고, 그래도 적으면 예산만 봐요.
  let pool = strict;
  if (pool.length < limit && filters.maxDifficulty) {
    pool = base.filter((w) => {
      if (filters.maxPriceKrw && w.priceKrw[0] > filters.maxPriceKrw) return false;
      return w.difficulty <= Math.min(5, filters.maxDifficulty! + 1);
    });
  }
  if (pool.length < limit) pool = base;

  const scored = pool
    .map((whisky) => ({
      whisky,
      score: matchScore(profile, whisky),
      percent: matchPercent(profile, whisky),
    }))
    .sort((a, b) => b.score - a.score);

  // 다양성: 같은 증류소는 후보에 하나만.
  const seenDistillery = new Set<string>();
  const diverse: ScoredWhisky[] = [];
  for (const s of scored) {
    if (seenDistillery.has(s.whisky.distillery)) continue;
    seenDistillery.add(s.whisky.distillery);
    diverse.push(s);
    if (diverse.length >= limit) break;
  }
  return diverse;
}

/** 프로필을 한 줄로 요약 (AI 없이 쓰는 폴백 / 프롬프트 재료) */
export function describeProfile(profile: TasteProfile): string[] {
  const out: string[] = [];
  const say = (cond: boolean, text: string) => cond && out.push(text);
  say(profile.peat >= 1, "연기·불맛 향을 좋아해요");
  say(profile.peat <= -1, "연기 향은 피하고 싶어요");
  say(profile.sweet >= 1, "달콤한 맛을 선호해요");
  say(profile.sweet <= -1, "단맛은 적은 편이 좋아요");
  say(profile.fruit >= 1, "과일 향을 좋아해요");
  say(profile.floral >= 1, "꽃·풀 같은 산뜻한 향을 좋아해요");
  say(profile.spice >= 1, "스파이시한 자극을 즐겨요");
  say(profile.spice <= -1, "자극이 적고 순한 쪽이 좋아요");
  say(profile.oak >= 1, "나무·견과 같은 묵직한 향을 좋아해요");
  say(profile.body >= 1, "진하고 무게감 있는 술이 좋아요");
  say(profile.body <= -1, "가볍고 부드러운 술이 좋아요");
  if (out.length === 0) out.push("아직 뚜렷한 취향이 없어요. 여러 스타일을 시도해봐요");
  return out;
}
