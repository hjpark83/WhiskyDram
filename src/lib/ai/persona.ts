import {
  AGE_LABELS_KO,
  hasPersona,
  SCENE_LABELS_KO,
  type Persona,
} from "@/data/persona";

/**
 * 내 정보를 프롬프트에 넣을 문장으로.
 *
 * **성별은 절대 넣지 않아요.** 성별로 취향을 가르면 추천이 나빠져요.
 * 나이대는 도수·가격 감각의 참고로만 넣고, 단정하지 말라고 함께 적어요.
 */
export function personaText(persona: Persona | null | undefined): string | null {
  if (!hasPersona(persona)) return null;

  const lines: string[] = [];
  if (persona.ageBand) {
    lines.push(
      `- 나이대: ${AGE_LABELS_KO[persona.ageBand]} (도수·가격 감각 참고용이에요. "이 나이대는 이런 걸 좋아한다"고 단정하지 마세요.)`,
    );
  }
  if (persona.scenes.length > 0) {
    lines.push(`- 주로 마시는 상황: ${persona.scenes.map((s) => SCENE_LABELS_KO[s]).join(", ")}`);
  }
  if (persona.likes.trim()) lines.push(`- 본인이 말한 좋아하는 향·맛: ${persona.likes.trim()}`);
  if (persona.avoids.trim()) {
    lines.push(`- 본인이 말한 피하고 싶은 것: ${persona.avoids.trim()} (이건 꼭 지켜주세요.)`);
  }

  return lines.length > 0 ? `## 이 사람에 대해\n${lines.join("\n")}` : null;
}

/** DB 행 → Persona (칸이 아직 없거나 비어 있어도 안전하게) */
export function personaFromRow(row: Record<string, unknown> | null | undefined): Persona {
  const scenes = Array.isArray(row?.drink_scenes)
    ? (row.drink_scenes as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  return {
    ageBand: (typeof row?.age_band === "string" ? row.age_band : null) as Persona["ageBand"],
    gender: (typeof row?.gender === "string" ? row.gender : null) as Persona["gender"],
    scenes: scenes as Persona["scenes"],
    likes: typeof row?.likes_note === "string" ? row.likes_note : "",
    avoids: typeof row?.avoids_note === "string" ? row.avoids_note : "",
  };
}

/** 내 정보를 읽을 때 select 할 칸 */
export const PERSONA_COLUMNS = "age_band, gender, drink_scenes, likes_note, avoids_note";
