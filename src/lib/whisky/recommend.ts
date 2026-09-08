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
  type TasteAxis,
  type TasteProfile,
  type Whisky,
} from "@/lib/whisky/types";

// ---------------------------------------------------------------------------
// 취향 프로필 계산
// ---------------------------------------------------------------------------

/** -2..+2 로 자르고 소수점 한 자리로 정리 (후기 누적이 조금씩 반영되게 정수로 반올림하지 않아요) */
export function clampProfile(p: TasteProfile): TasteProfile {
  const out = { ...p };
  for (const axis of TASTE_AXES) {
    const v = Math.max(-2, Math.min(2, out[axis] ?? 0));
    out[axis] = Math.round(v * 10) / 10;
  }
  return out;
}

/** 진단 답변 → 취향 프로필 (-2..+2) */
/**
 * 축마다 **양수 쪽과 음수 쪽을 따로** 재요 — 질문지를 늘려도 자동으로 다시 계산돼요.
 *
 * 예전엔 max|델타| 의 합 하나로 나눴는데, 그러면 "싫어요" 가 절반 눈금밖에 못 써요.
 * 피트가 그랬어요: 원점수가 [-2, +4] 인데 분모가 4 라서, 제일 강한 거부인
 * "연기 냄새는 싫어요"(-2) 를 골라도 -1 까지밖에 안 내려갔어요. 좋아함은 +2 로
 * 꽉 차는데 싫어함만 반쪽이었던 거예요.
 *
 * 그래서 도달 가능한 양수 합·음수 합으로 각각 나눠, 양쪽 다 끝까지 쓰게 했어요.
 */
const AXIS_SCALE: Record<TasteAxis, { pos: number; neg: number }> = (() => {
  const scale = Object.fromEntries(
    TASTE_AXES.map((a) => [a, { pos: 0, neg: 0 }]),
  ) as Record<TasteAxis, { pos: number; neg: number }>;
  for (const q of QUIZ_QUESTIONS) {
    for (const axis of TASTE_AXES) {
      const deltas = q.options.map((o) => o.delta?.[axis] ?? 0);
      scale[axis].pos += Math.max(0, ...deltas);
      scale[axis].neg += Math.abs(Math.min(0, ...deltas));
    }
  }
  return scale;
})();

export type AxisBounds = Partial<Record<TasteAxis, { min?: number; max?: number }>>;

/**
 * 그 축을 **직접** 물어본 답이 정한 범위.
 *
 * AI 취향 분석도 이 범위를 지켜야 해요. "연기 냄새는 싫어요" 라고 직접 답했는데
 * AI 가 다른 답을 보고 피트를 +1 로 올려버리면 안 되니까요.
 */
export function decisiveBounds(answers: QuizAnswers): AxisBounds {
  const bounds: AxisBounds = {};
  for (const q of QUIZ_QUESTIONS) {
    const option = q.options.find((o) => o.id === answers[q.id]);
    for (const [axis, b] of Object.entries(option?.decisive ?? {})) {
      const prev = bounds[axis as TasteAxis] ?? {};
      bounds[axis as TasteAxis] = {
        min: b.min === undefined ? prev.min : Math.max(prev.min ?? -Infinity, b.min),
        max: b.max === undefined ? prev.max : Math.min(prev.max ?? Infinity, b.max),
      };
    }
  }
  return bounds;
}

/** 직접 물어본 답이 정한 범위로 프로필을 잘라요 */
export function applyBounds(profile: TasteProfile, bounds: AxisBounds): TasteProfile {
  const out = { ...profile };
  for (const axis of TASTE_AXES) {
    const b = bounds[axis];
    if (b?.max !== undefined) out[axis] = Math.min(out[axis], b.max);
    if (b?.min !== undefined) out[axis] = Math.max(out[axis], b.min);
  }
  return clampProfile(out);
}

export function profileFromAnswers(answers: QuizAnswers): TasteProfile {
  const raw: TasteProfile = { ...EMPTY_TASTE_PROFILE };
  const bounds = decisiveBounds(answers);

  for (const q of QUIZ_QUESTIONS) {
    const option = q.options.find((o) => o.id === answers[q.id]);
    for (const [axis, d] of Object.entries(option?.delta ?? {})) {
      raw[axis as keyof TasteProfile] += d ?? 0;
    }
  }

  // 양수·음수 쪽을 각각의 최댓값으로 나눠 -2..+2 로 폅니다 (질문 수와 무관하게 같은 눈금)
  for (const axis of TASTE_AXES) {
    const { pos, neg } = AXIS_SCALE[axis];
    const max = raw[axis] >= 0 ? pos : neg;
    raw[axis] = max > 0 ? Math.round((raw[axis] / max) * 2) : 0;

    // 직접 물어본 답이 간접 힌트에 밀리지 않게 마지막에 한 번 더 잘라요
    const b = bounds[axis];
    if (b?.max !== undefined) raw[axis] = Math.min(raw[axis], b.max);
    if (b?.min !== undefined) raw[axis] = Math.max(raw[axis], b.min);
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

/**
 * 별점만으로 계산하는 규칙 기반 델타 (AI 폴백 / 후보 선별용 임시 프로필).
 * 그 병에서 두드러진 축(향미 4~5)만 움직여요. 좋았으면 그쪽으로, 별로였으면 반대로.
 * 약한 축(예: 라프로익의 단맛)은 "그게 없어서 좋았다"는 근거가 못 되니 건드리지 않아요.
 */
export function ruleDeltasFromNote(whisky: Whisky, rating: number): Partial<TasteProfile> {
  const direction = (rating - 3) / 2; // -1..+1
  const out: Partial<TasteProfile> = {};
  if (direction === 0) return out;
  for (const axis of TASTE_AXES) {
    const f = whisky.flavor[axis];
    const strength = f >= 5 ? 2 : f >= 4 ? 1 : 0;
    if (strength === 0) continue;
    const raw = direction * strength;
    const d = Math.sign(raw) * Math.round(Math.abs(raw));
    if (d !== 0) out[axis] = Math.max(-2, Math.min(2, d));
  }
  return out;
}

export function hasProfile(profile: Partial<TasteProfile> | null | undefined) {
  if (!profile) return false;
  return TASTE_AXES.some((axis) => (profile[axis] ?? 0) !== 0);
}

// ---------------------------------------------------------------------------
// 점수 계산
// ---------------------------------------------------------------------------

/**
 * 싫다고 답한 축의 가중치.
 *
 * 사람은 좋아하는 향보다 싫어하는 향에 훨씬 민감해요. "연기 싫어요" 라고 답한
 * 사람에게는 나머지가 아무리 맞아도 피트 위스키가 좋은 추천이 아니에요.
 * 그런데 예전엔 7개 축을 똑같이 더해서, 단맛·오크·바디가 잘 맞으면 그 셋이
 * 피트 감점을 이기고 라가불린이 1등으로 올라왔어요.
 */
const DISLIKE_WEIGHT = 1.6;

/** 그 축의 가중치 (싫어하는 쪽을 더 무겁게) */
function axisWeight(pref: number): number {
  return pref < 0 ? DISLIKE_WEIGHT : 1;
}

/**
 * 취향(-2..+2) · 향미(0..5) 적합도.
 * 향미를 중앙(2.5) 기준으로 -2.5..+2.5 로 옮긴 뒤 내적.
 * 사용자가 신경 안 쓰는 축(0)은 자연스럽게 무시돼요.
 */
export function matchScore(profile: TasteProfile, whisky: Whisky): number {
  let score = 0;
  for (const axis of TASTE_AXES) {
    const pref = profile[axis];
    score += pref * (whisky.flavor[axis] - 2.5) * axisWeight(pref);
  }
  return score;
}

/** 0..100 로 보기 좋게 정규화한 적합도. 프로필이 비어 있으면 null. */
export function matchPercent(profile: TasteProfile, whisky: Whisky): number | null {
  if (!hasProfile(profile)) return null;
  // 이 프로필에서 가능한 최대 점수 = Σ |pref| * 2.5 * 가중치
  const max = TASTE_AXES.reduce(
    (acc, a) => acc + Math.abs(profile[a]) * 2.5 * axisWeight(profile[a]),
    0,
  );
  if (max === 0) return null;
  const s = matchScore(profile, whisky);
  return Math.round(((s / max + 1) / 2) * 100);
}

/**
 * "싫어요" 가 가중치가 아니라 **거르는 조건**인 축.
 *
 * 연기(피트)와 자극(스파이시)은 정도의 문제가 아니라 호불호가 갈리는 향이에요.
 * 싫다고 답했으면 점수를 깎는 게 아니라 후보에서 빼는 게 맞아요. 반대로
 * 단맛·오크·바디는 "덜한 게 좋다" 는 정도 차이라 가중치로만 봐요.
 */
const AVERSION_AXES = ["peat", "spice"] as const;

/** 싫다고 답한 향이 강한 병인가요? */
export function isAverted(profile: TasteProfile, whisky: Whisky): boolean {
  for (const axis of AVERSION_AXES) {
    const pref = profile[axis] ?? 0;
    if (pref > -1) continue;
    let intensity = whisky.flavor[axis];
    // 향미 숫자가 낮아도 피트로 파는 병이면 피트로 쳐요
    if (axis === "peat" && whisky.styles.includes("peated")) {
      intensity = Math.max(intensity, 3);
    }
    // 아주 싫으면(-2) 은은한 것까지, 그냥 싫으면(-1) 뚜렷한 것만 빼요
    if (intensity >= (pref <= -2 ? 3 : 4)) return true;
  }
  return false;
}

export interface CandidateFilters {
  maxPriceKrw?: number | null;
  maxDifficulty?: 1 | 2 | 3 | 4 | 5;
  excludeIds?: string[];
  /** 한정판(싱글 캐스크·품절)도 후보에 넣을지. 기본은 안 넣어요 — 살 수 없으니까요. */
  includeLimited?: boolean;
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
  // 싫다고 답한 향과 살 수 없는 한정판은 여기서 미리 빼요.
  // 아래 완화 단계에서도 다시 들어오면 안 되니까 앞에서 걸러요.
  const base = WHISKIES.filter(
    (w) =>
      !excluded.has(w.id) &&
      !isAverted(profile, w) &&
      (filters.includeLimited || !w.limited),
  );

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

/** 향미 벡터가 가까운 다른 병 (같은 병·제외 목록 제외). "이게 좋았으면 다음은 이것" 용도. */
export function similarByFlavor(target: Whisky, n = 3, excludeIds: string[] = []): Whisky[] {
  const excluded = new Set([target.id, ...excludeIds]);
  return WHISKIES.filter((w) => !excluded.has(w.id))
    .map((w) => ({
      w,
      d: TASTE_AXES.reduce((acc, a) => acc + (w.flavor[a] - target.flavor[a]) ** 2, 0),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.w);
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
