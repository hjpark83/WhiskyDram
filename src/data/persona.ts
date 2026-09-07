/**
 * 내 정보(페르소나).
 *
 * 추천에 **쓰는 것**과 **쓰지 않는 것**을 명확히 나눠요.
 *
 *  - 쓰는 것: 마시는 상황, 좋아하는 향·맛, 피하고 싶은 것.
 *    이건 사람이 직접 말한 취향이라 추천이 좋아져요.
 *  - 참고만 하는 것: 나이대. 도수·가격 감각에 도움이 되지만
 *    "이 나이대는 이런 걸 좋아한다" 는 단정은 프롬프트에서 금지해요.
 *  - 쓰지 않는 것: 성별. 성별로 취향을 가르면 추천이 오히려 나빠져요.
 *    저장은 하되 추천 계산·프롬프트에는 절대 넣지 않아요.
 */

export type AgeBand = "10s" | "20s" | "30s" | "40s" | "50plus";
export type Gender = "female" | "male" | "other";
export type DrinkScene = "alone" | "friends" | "meal" | "highball" | "gift" | "collect";

export interface Persona {
  ageBand: AgeBand | null;
  gender: Gender | null;
  scenes: DrinkScene[];
  /** 좋아하는 향·맛 (자유 입력) */
  likes: string;
  /** 피하고 싶은 것 (자유 입력) */
  avoids: string;
}

export const EMPTY_PERSONA: Persona = {
  ageBand: null,
  gender: null,
  scenes: [],
  likes: "",
  avoids: "",
};

export const AGE_BANDS: { id: AgeBand; label: string }[] = [
  { id: "10s", label: "19세 이하" },
  { id: "20s", label: "20대" },
  { id: "30s", label: "30대" },
  { id: "40s", label: "40대" },
  { id: "50plus", label: "50대 이상" },
];

export const GENDERS: { id: Gender; label: string }[] = [
  { id: "female", label: "여성" },
  { id: "male", label: "남성" },
  { id: "other", label: "그 외" },
];

export const DRINK_SCENES: { id: DrinkScene; label: string; hint: string }[] = [
  { id: "alone", label: "혼자 집에서", hint: "천천히 향을 보는 자리" },
  { id: "friends", label: "친구들과", hint: "여럿이 나눠 마셔요" },
  { id: "meal", label: "식사와 함께", hint: "안주·요리에 곁들여요" },
  { id: "highball", label: "하이볼로", hint: "탄산에 섞어 가볍게" },
  { id: "gift", label: "선물용", hint: "받는 사람이 무난히 좋아할 병" },
  { id: "collect", label: "모으는 재미", hint: "새로운 병을 시도해봐요" },
];

export const AGE_LABELS_KO: Record<AgeBand, string> = Object.fromEntries(
  AGE_BANDS.map((a) => [a.id, a.label]),
) as Record<AgeBand, string>;

export const GENDER_LABELS_KO: Record<Gender, string> = Object.fromEntries(
  GENDERS.map((g) => [g.id, g.label]),
) as Record<Gender, string>;

export const SCENE_LABELS_KO: Record<DrinkScene, string> = Object.fromEntries(
  DRINK_SCENES.map((s) => [s.id, s.label]),
) as Record<DrinkScene, string>;

/** 하나라도 채웠는지 */
export function hasPersona(p: Persona | null | undefined): p is Persona {
  if (!p) return false;
  return Boolean(p.ageBand || p.scenes.length > 0 || p.likes.trim() || p.avoids.trim());
}
