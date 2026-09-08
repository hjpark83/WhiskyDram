import { z } from "zod";
import { QUIZ_QUESTIONS, type QuizAnswers } from "@/data/quiz";
import type { Persona } from "@/data/persona";
import { personaText } from "@/lib/ai/persona";
import { activeProvider, generateJson, toAiError } from "@/lib/ai/provider";
import {
  applyBounds,
  clampProfile,
  decisiveBounds,
  describeProfile,
  profileFromAnswers,
} from "@/lib/whisky/recommend";
import { AXIS_LABELS_KO, TASTE_AXES, type TasteProfile } from "@/lib/whisky/types";

/**
 * AI 취향 분석.
 *
 * 예전에는 AI 가 **설명만** 썼어요. 어떤 병을 후보에 올릴지 정하는 취향 벡터는
 * 선택지마다 박아둔 숫자를 더한 값이었죠. 그래서 질문지에 없는 이야기 — 내 정보에
 * 직접 쓴 "저는 소독약 냄새가 싫어요" 같은 문장 — 는 추천에 전혀 반영되지 않았어요.
 *
 * 이제 AI 가 답변 전체와 자유 입력을 함께 읽고 취향 벡터를 직접 만들어요.
 *
 * 다만 AI 에게 전권을 주지는 않아요. 그 축을 **직접 물어본 답**(`decisive`)은
 * 그대로 지켜요. "연기 냄새는 싫어요" 라고 답했는데 AI 가 다른 답을 보고 피트를
 * 올려버리면, 고쳐놓은 버그가 AI 를 통해 되살아나니까요.
 */

export interface TasteAnalysis {
  profile: TasteProfile;
  /** 왜 이렇게 봤는지 한두 문장 (화면에 보여줘요) */
  summary: string;
  generatedBy: "ai" | "fallback";
  model: string | null;
  provider: string | null;
}

const SYSTEM_PROMPT = `당신은 위스키 취향을 숫자로 옮기는 분석가예요.

사용자의 답변을 읽고 7개 축을 각각 -2 ~ +2 정수로 매겨주세요.
  -2 = 아주 싫어함 / -1 = 별로 / 0 = 상관없음·모르겠음 / +1 = 좋아함 / +2 = 아주 좋아함

원칙:
- **싫다는 신호를 절대 약하게 적지 마세요.** 싫다고 말한 걸 0 으로 적으면 그 향이
  강한 술이 그대로 추천돼요. 싫다고 했으면 -2 나 -1 로 분명히 적어요.
- 근거가 없는 축은 억지로 채우지 말고 0 으로 두세요. 0 은 "이 축은 신경 안 씀"
  이라는 뜻이라 추천에서 자연스럽게 무시돼요.
- 자유 입력("좋아하는 향", "피하고 싶은 것")이 있으면 그게 가장 강한 근거예요.
  선택지 답변보다 우선해요.
- summary 는 한국어 ~해요체로 2문장 이내. 위스키 용어를 쓰면 괄호로 쉬운 말을 붙여요.
- 나이대나 성별로 취향을 단정하지 마세요.`;

const AXIS_HINTS: Record<string, string> = {
  peat: "모닥불·훈제·소독약 같은 연기 향",
  fruit: "사과·배·건포도 같은 과일 향",
  sweet: "꿀·바닐라·캐러멜 같은 단맛",
  spice: "후추·계피 같은 알싸한 자극",
  floral: "꽃·풀·허브 같은 산뜻한 향",
  oak: "나무·견과·가죽 같은 묵직한 향",
  body: "입에 남는 무게감 (-2 가벼움 ~ +2 묵직함)",
};

const Schema = z.object({
  peat: z.number().describe(`${AXIS_HINTS.peat}. -2~+2 정수.`),
  fruit: z.number().describe(`${AXIS_HINTS.fruit}. -2~+2 정수.`),
  sweet: z.number().describe(`${AXIS_HINTS.sweet}. -2~+2 정수.`),
  spice: z.number().describe(`${AXIS_HINTS.spice}. -2~+2 정수.`),
  floral: z.number().describe(`${AXIS_HINTS.floral}. -2~+2 정수.`),
  oak: z.number().describe(`${AXIS_HINTS.oak}. -2~+2 정수.`),
  body: z.number().describe(`${AXIS_HINTS.body}. -2~+2 정수.`),
  summary: z.string().describe("이렇게 본 이유를 한국어 2문장 이내로."),
});

function answersText(answers: QuizAnswers): string {
  return QUIZ_QUESTIONS.map((q) => {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    return `- ${q.question} → ${opt?.label ?? "(무응답)"}`;
  }).join("\n");
}

export async function analyzeTaste(
  answers: QuizAnswers,
  persona?: Persona | null,
): Promise<TasteAnalysis> {
  const ruleProfile = profileFromAnswers(answers);
  const provider = activeProvider();
  if (!provider) return fallbackAnalysis(ruleProfile);

  const persona_ = personaText(persona);
  const userMessage = [
    ...(persona_ ? [persona_, ""] : []),
    "## 취향 진단 답변",
    answersText(answers),
    "",
    "## 참고: 선택지 숫자만 더해서 계산한 값",
    TASTE_AXES.map((a) => `- ${AXIS_LABELS_KO[a]}: ${ruleProfile[a]}`).join("\n"),
    "(이건 참고예요. 답변과 자유 입력을 직접 읽고 더 정확하다고 판단되면 바꾸세요.)",
    "",
    "위 사람의 취향을 7개 축 숫자로 매기고, 그렇게 본 이유를 적어주세요.",
  ].join("\n");

  try {
    const { data: out, model } = await generateJson({
      system: SYSTEM_PROMPT,
      user: userMessage,
      schema: Schema,
      schemaName: "taste_analysis",
      maxTokens: 4096,
      effort: "low",
    });

    const raw = clampProfile(
      Object.fromEntries(
        TASTE_AXES.map((a) => [a, Math.round(out[a] ?? 0)]),
      ) as TasteProfile,
    );

    return {
      // 직접 물어본 답은 AI 도 못 뒤집어요
      profile: applyBounds(raw, decisiveBounds(answers)),
      summary: out.summary,
      generatedBy: "ai",
      model,
      provider: provider.label,
    };
  } catch (error) {
    const err = toAiError(error);
    console.error(`[ai/taste] ${provider.id} 실패 (${err.kind}): ${err.message}`);
    return fallbackAnalysis(ruleProfile);
  }
}

/** 키가 없거나 호출이 실패해도 데모가 멈추면 안 돼요 */
export function fallbackAnalysis(profile: TasteProfile): TasteAnalysis {
  return {
    profile,
    summary: describeProfile(profile).join(". ") + ".",
    generatedBy: "fallback",
    model: null,
    provider: null,
  };
}
