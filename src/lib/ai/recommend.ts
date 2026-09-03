import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CLAUDE_MODEL, getAnthropic } from "@/lib/ai/client";
import { AXIS_LABELS_KO, TASTE_AXES, type TasteProfile, type Whisky } from "@/lib/whisky/types";
import { describeProfile, type ScoredWhisky } from "@/lib/whisky/recommend";
import {
  formatPriceRange,
  getOrigin,
  ORIGIN_LABELS_KO,
  STYLE_LABELS_KO,
  TYPE_LABELS_KO,
} from "@/lib/whisky/format";
import { QUIZ_QUESTIONS, type QuizAnswers } from "@/data/quiz";

// ---------------------------------------------------------------------------
// 결과 타입 (recommendations.payload 에 그대로 저장)
// ---------------------------------------------------------------------------

export interface RecommendationPick {
  whiskyId: string;
  headline: string;
  reason: string;
  howToDrink: string;
  pairing: string;
  caution: string | null;
}

export interface RecommendationPayload {
  tasteTitle: string;
  tasteSummary: string;
  picks: RecommendationPick[];
  nextStep: string;
  generatedBy: "claude" | "fallback";
  model: string | null;
}

// ---------------------------------------------------------------------------
// 프롬프트 재료
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `당신은 위스키를 처음 시작하는 한국인을 돕는 친절한 소믈리에예요.

원칙:
- 모든 문장은 한국어, 부드러운 ~해요체. 친구에게 설명하듯 편하게.
- 위스키 전문 용어(피트, 셰리 캐스크, 피니시, 캐스크 스트렝스 등)는 쓰지 않거나, 쓰면 바로 괄호로 쉬운 말을 붙여요. 예: "피트(모닥불 같은 연기 향)".
- 사용자의 일상 답변(커피·디저트·매운맛 취향 등)을 근거로 연결해서 설명해요. "라떼를 좋아하신다니 달콤하고 부드러운 쪽이 잘 맞을 거예요"처럼.
- 후보 목록 안에서만 골라요. 목록에 없는 위스키를 지어내지 마세요.
- 세 병은 서로 다른 스타일이면 좋아요 (예: 가장 안전한 선택 / 취향에 딱 맞는 선택 / 살짝 도전하는 선택).
- 과장하지 않아요. 가격은 후보에 적힌 범위를 그대로 말해요.
- 각 필드는 짧게. reason 은 2~3문장, 나머지는 1~2문장.`;

function profileText(profile: TasteProfile): string {
  const axes = TASTE_AXES.map(
    (a) => `${AXIS_LABELS_KO[a]}: ${profile[a] > 0 ? "+" : ""}${profile[a]}`,
  ).join(", ");
  return `취향 벡터 (-2 싫어함 ~ +2 좋아함): ${axes}\n요약: ${describeProfile(profile).join(" / ")}`;
}

function answersText(answers: QuizAnswers): string {
  return QUIZ_QUESTIONS.map((q) => {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    return `- ${q.question} → ${opt?.label ?? "(무응답)"}`;
  }).join("\n");
}

function whiskyCard(w: Whisky, percent: number | null): string {
  const flavor = TASTE_AXES.map((a) => `${AXIS_LABELS_KO[a]} ${w.flavor[a]}`).join(", ");
  return [
    `[${w.id}] ${w.nameKo} (${w.name})`,
    `  분류: ${ORIGIN_LABELS_KO[getOrigin(w)]} · ${TYPE_LABELS_KO[w.type]}${w.styles.length ? ` · 스타일: ${w.styles.map((t) => STYLE_LABELS_KO[t]).join(", ")}` : ""}`,
    `  ${w.country} · ${w.abv}% · 가격 ${formatPriceRange(w.priceKrw)} · 난이도 ${w.difficulty}/5${percent !== null ? ` · 계산된 적합도 ${percent}%` : ""}`,
    `  향미(0~5): ${flavor}`,
    `  향: ${w.notes.nose} / 맛: ${w.notes.palate} / 여운: ${w.notes.finish}`,
    `  메모: ${w.beginnerTip}`,
    `  어울리는 음식: ${w.pairings.join(", ")}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Claude 호출
// ---------------------------------------------------------------------------

export interface GenerateInput {
  profile: TasteProfile;
  answers: QuizAnswers;
  candidates: ScoredWhisky[];
}

export async function generateQuizRecommendation(
  input: GenerateInput,
): Promise<RecommendationPayload> {
  const client = getAnthropic();
  if (!client || input.candidates.length < 3) return fallbackRecommendation(input);

  const ids = input.candidates.map((c) => c.whisky.id) as [string, ...string[]];

  const Schema = z.object({
    tasteTitle: z
      .string()
      .describe("사용자 취향을 한 마디로 부르는 별명. 예: '달콤한 과일파', '은은한 불맛 탐험가'. 10자 이내."),
    tasteSummary: z
      .string()
      .describe("사용자의 답변을 근거로 취향을 2~3문장으로 설명. 용어 없이."),
    picks: z
      .array(
        z.object({
          whiskyId: z.enum(ids).describe("후보 목록의 id"),
          headline: z.string().describe("이 병을 한 줄로 소개하는 카피. 15자 이내."),
          reason: z.string().describe("왜 이 사용자에게 맞는지, 답변을 근거로 2~3문장."),
          howToDrink: z
            .string()
            .describe("처음 마실 때 추천하는 방법 (그대로 / 얼음 넣어서 / 탄산수 섞어 하이볼 등)과 이유. 1~2문장."),
          pairing: z.string().describe("함께 먹으면 좋은 안주 1~2개. 한 문장."),
          caution: z
            .string()
            .nullable()
            .describe("주의할 점이 있으면 한 문장 (도수가 높다, 향이 강하다 등). 없으면 null."),
        }),
      )
      .length(3)
      .describe("정확히 3병. 서로 다른 id."),
    nextStep: z
      .string()
      .describe("이 3병 중 하나를 마신 뒤 어떤 후기를 남기면 좋을지, 다음에 뭘 시도해볼지 한두 문장."),
  });

  const userMessage = [
    "## 사용자의 진단 답변",
    answersText(input.answers),
    "",
    "## 계산된 취향 프로필",
    profileText(input.profile),
    "",
    "## 후보 위스키 (이 안에서만 3병 선택)",
    input.candidates.map((c) => whiskyCard(c.whisky, c.percent)).join("\n\n"),
    "",
    "위 후보 중 이 사용자에게 가장 잘 맞는 3병을 골라 설명해주세요.",
  ].join("\n");

  try {
    const response = await client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      output_config: { effort: "medium", format: zodOutputFormat(Schema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("[ai/recommend] no parsed output", response.stop_reason);
      return fallbackRecommendation(input);
    }

    const out = response.parsed_output;
    // 같은 병이 두 번 나오면 폴백 후보로 채워요.
    const seen = new Set<string>();
    const picks: RecommendationPick[] = [];
    for (const p of out.picks) {
      if (seen.has(p.whiskyId)) continue;
      seen.add(p.whiskyId);
      picks.push(p);
    }
    for (const c of input.candidates) {
      if (picks.length >= 3) break;
      if (seen.has(c.whisky.id)) continue;
      seen.add(c.whisky.id);
      picks.push(templatePick(c.whisky));
    }

    return {
      tasteTitle: out.tasteTitle,
      tasteSummary: out.tasteSummary,
      picks,
      nextStep: out.nextStep,
      generatedBy: "claude",
      model: response.model,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[ai/recommend] API error ${error.status}: ${error.message}`);
    } else {
      console.error("[ai/recommend] unexpected error", error);
    }
    return fallbackRecommendation(input);
  }
}

// ---------------------------------------------------------------------------
// 폴백 (API 키 없음 / 오류) — 데모가 절대 멈추지 않게
// ---------------------------------------------------------------------------

function templatePick(w: Whisky): RecommendationPick {
  const highball = w.priceKrw[1] <= 60000 || w.flavor.body <= 1;
  return {
    whiskyId: w.id,
    headline: w.beginnerTip.split(/[.。]/)[0].slice(0, 30),
    reason: `${w.notes.nose} 같은 향에 ${w.notes.palate.replace(/\.$/, "")}. 지금 취향 프로필과 방향이 잘 맞아요.`,
    howToDrink: highball
      ? "처음엔 얼음 없이 한 모금, 그다음 탄산수를 섞어 하이볼로도 비교해보세요."
      : "먼저 그대로 한 모금 맛보고, 강하게 느껴지면 얼음 하나를 넣어보세요.",
    pairing: `${w.pairings.slice(0, 2).join(", ")}와 함께 드시면 좋아요.`,
    caution:
      w.abv >= 50
        ? `도수가 ${w.abv}%로 높아요. 물을 몇 방울 섞으면 향이 더 잘 느껴져요.`
        : w.flavor.peat >= 4
          ? "연기 향이 강한 편이에요. 처음엔 낯설 수 있어요."
          : null,
  };
}

function titleFor(profile: TasteProfile): string {
  if (profile.peat >= 1) return "은은한 불맛 탐험가";
  if (profile.sweet >= 1 && profile.fruit >= 1) return "달콤한 과일파";
  if (profile.sweet >= 1) return "부드러운 단맛파";
  if (profile.floral >= 1) return "산뜻한 꽃향기파";
  if (profile.oak >= 1 || profile.body >= 1) return "묵직한 클래식파";
  if (profile.spice >= 1) return "짜릿한 스파이시파";
  return "열린 마음의 탐험가";
}

export function fallbackRecommendation(input: GenerateInput): RecommendationPayload {
  const top = input.candidates.slice(0, 3);
  return {
    tasteTitle: titleFor(input.profile),
    tasteSummary: describeProfile(input.profile).join(". ") + ".",
    picks: top.map((c) => templatePick(c.whisky)),
    nextStep:
      "이 중 한 병을 마셔보고 '어떤 향이 좋았고 어떤 게 별로였는지' 한 줄만 남겨주세요. 다음 추천이 달라져요.",
    generatedBy: "fallback",
    model: null,
  };
}
