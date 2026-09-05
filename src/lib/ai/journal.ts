import { z } from "zod";
import { activeProvider, generateJson, toAiError } from "@/lib/ai/provider";
import {
  profileText,
  templatePick,
  titleFor,
  whiskyCard,
  type RecommendationBasis,
  type RecommendationPayload,
  type RecommendationPick,
} from "@/lib/ai/recommend";
import {
  applyDeltas,
  describeProfile,
  ruleDeltasFromNote,
  type ScoredWhisky,
} from "@/lib/whisky/recommend";
import { AXIS_LABELS_KO, TASTE_AXES, type TasteProfile, type Whisky } from "@/lib/whisky/types";

/**
 * 프로필에 델타를 얼마나 반영할지.
 * 초반 후기는 진단보다 훨씬 확실한 정보라 크게, 후기가 쌓일수록 조금씩.
 */
export function noteWeight(historyCount: number): number {
  if (historyCount < 3) return 1;
  if (historyCount < 10) return 0.75;
  return 0.5;
}

export interface NoteHistoryItem {
  whisky: Whisky;
  rating: number;
  review: string;
}

export interface JournalInput {
  whisky: Whisky;
  rating: number;
  review: string;
  profileBefore: TasteProfile;
  history: NoteHistoryItem[]; // 최근 후기 (이번 것 제외, 최신순)
  candidates: ScoredWhisky[]; // 임시 프로필로 뽑은 후보
}

export interface JournalResult {
  payload: RecommendationPayload; // basedOn 포함
  profileAfter: TasteProfile;
}

const SYSTEM_PROMPT = `당신은 위스키를 처음 시작하는 한국인을 돕는 친절한 소믈리에예요.
사용자가 마신 위스키의 후기를 읽고 (1) 취향이 어떻게 바뀌었는지 분석하고 (2) 다음에 마실 3병을 골라요.

원칙:
- 모든 문장은 한국어, 부드러운 ~해요체. 전문 용어는 쓰지 않거나 괄호로 쉬운 말을 붙여요.
- 후기 문장을 근거로 삼아요. "연기 향이 낯설었다"고 하면 피트 축을 내리고, "달아서 좋았다"면 단맛 축을 올려요.
- 별점은 방향, 후기 문장은 세부. 별점이 높아도 "OO은 별로"라고 쓴 요소는 내려요.
- 델타는 -2..+2 정수. 후기에서 언급되지 않은 축은 0. 확신이 없으면 ±1.
- 다음 3병은 후보 목록 안에서만. 이미 마신 병은 없어요. 하나는 이번 후기에서 좋았던 방향을 더 밀어주는 병, 하나는 안전한 선택, 하나는 살짝 다른 시도를 권해요.
- 각 필드는 짧게. reason 은 2~3문장, 나머지는 1~2문장.`;

function historyText(history: NoteHistoryItem[]): string {
  if (history.length === 0) return "(첫 후기예요)";
  return history
    .slice(0, 5)
    .map((h) => `- ${h.whisky.nameKo} ${"★".repeat(h.rating)} : ${h.review}`)
    .join("\n");
}

export async function generateJournalRecommendation(input: JournalInput): Promise<JournalResult> {
  const provider = activeProvider();
  if (!provider || input.candidates.length < 3) return fallbackJournal(input);

  const ids = input.candidates.map((c) => c.whisky.id) as [string, ...string[]];
  const delta = z.number().int().min(-2).max(2);

  const Schema = z.object({
    summary: z.string().describe("후기를 한 문장으로 요약. 20자 내외."),
    liked: z.array(z.string()).max(4).describe("좋았던 요소. 짧은 명사구. 없으면 빈 배열."),
    disliked: z.array(z.string()).max(4).describe("별로였던 요소. 짧은 명사구. 없으면 빈 배열."),
    deltas: z
      .object({
        peat: delta,
        fruit: delta,
        sweet: delta,
        spice: delta,
        floral: delta,
        oak: delta,
        body: delta,
      })
      .describe("취향 축 변화. 언급 없는 축은 0."),
    explanation: z
      .string()
      .describe("취향이 어떻게 바뀌었는지 사용자에게 설명. 후기 문장을 인용하며 2문장."),
    tasteTitle: z.string().describe("갱신된 취향 별명. 10자 이내."),
    tasteSummary: z.string().describe("갱신된 취향을 2문장으로."),
    picks: z
      .array(
        z.object({
          whiskyId: z.enum(ids),
          headline: z.string().describe("한 줄 카피. 15자 이내."),
          reason: z.string().describe("이번 후기와 연결해서 왜 이 병인지 2~3문장."),
          howToDrink: z.string().describe("처음 마실 때 추천 방법과 이유. 1~2문장."),
          pairing: z.string().describe("어울리는 안주 1~2개. 한 문장."),
          caution: z.string().nullable().describe("주의점 한 문장, 없으면 null."),
        }),
      )
      .length(3),
    nextStep: z.string().describe("다음 후기에서 뭘 살펴보면 좋을지 한두 문장."),
  });

  const userMessage = [
    "## 이번에 마신 위스키",
    whiskyCard(input.whisky, null),
    "",
    `## 별점: ${input.rating} / 5`,
    `## 후기: "${input.review}"`,
    "",
    "## 이전 후기들",
    historyText(input.history),
    "",
    "## 후기 반영 전 취향 프로필",
    profileText(input.profileBefore),
    "",
    "## 다음 병 후보 (이 안에서만 3병 선택)",
    input.candidates.map((c) => whiskyCard(c.whisky, c.percent)).join("\n\n"),
    "",
    "후기를 분석해 취향 변화를 계산하고, 다음 3병을 골라주세요.",
  ].join("\n");

  try {
    const { data: out, model } = await generateJson({
      system: SYSTEM_PROMPT,
      user: userMessage,
      schema: Schema,
      schemaName: "journal_analysis",
      maxTokens: 4096,
      effort: "medium",
    });

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

    const profileAfter = applyDeltas(input.profileBefore, out.deltas, noteWeight(input.history.length));
    const basedOn: RecommendationBasis = {
      source: "review",
      noteId: null,
      whiskyId: input.whisky.id,
      rating: input.rating,
      review: input.review,
      summary: out.summary,
      liked: out.liked,
      disliked: out.disliked,
      deltas: out.deltas,
      explanation: out.explanation,
      profileBefore: input.profileBefore,
      profileAfter,
    };

    return {
      profileAfter,
      payload: {
        tasteTitle: out.tasteTitle,
        tasteSummary: out.tasteSummary,
        picks,
        nextStep: out.nextStep,
        generatedBy: "ai",
        model,
        provider: provider.label,
        basedOn,
      },
    };
  } catch (error) {
    const err = toAiError(error);
    console.error(`[ai/journal] ${provider.id} 실패 (${err.kind}): ${err.message}`);
    return fallbackJournal(input);
  }
}

// ---------------------------------------------------------------------------
// 폴백: 별점 기반 규칙 델타
// ---------------------------------------------------------------------------

export function fallbackJournal(input: JournalInput): JournalResult {
  const deltas = ruleDeltasFromNote(input.whisky, input.rating);
  const profileAfter = applyDeltas(input.profileBefore, deltas, noteWeight(input.history.length));
  const changed = TASTE_AXES.filter((a) => (deltas[a] ?? 0) !== 0).map(
    (a) => `${AXIS_LABELS_KO[a]} ${deltas[a]! > 0 ? "↑" : "↓"}`,
  );
  const tone = input.rating >= 4 ? "좋았다" : input.rating <= 2 ? "아쉬웠다" : "무난했다";

  return {
    profileAfter,
    payload: {
      tasteTitle: titleFor(profileAfter),
      tasteSummary: describeProfile(profileAfter).join(". ") + ".",
      picks: input.candidates.slice(0, 3).map((c) => templatePick(c.whisky)),
      nextStep: "다음 후기엔 '어떤 향이 좋았고 어떤 게 별로였는지'를 한 줄 더 적어주시면 분석이 정확해져요.",
      generatedBy: "fallback",
      model: null,
      basedOn: {
        source: "review",
        noteId: null,
        whiskyId: input.whisky.id,
        rating: input.rating,
        review: input.review,
        summary: `${input.whisky.nameKo}이(가) ${tone}는 후기`,
        liked: [],
        disliked: [],
        deltas,
        explanation:
          changed.length > 0
            ? `별점을 바탕으로 ${changed.join(", ")} 방향으로 취향을 조정했어요.`
            : "별점이 중간이라 취향 프로필은 그대로 두었어요.",
        profileBefore: input.profileBefore,
        profileAfter,
      },
    },
  };
}
