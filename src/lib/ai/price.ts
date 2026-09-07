import { z } from "zod";
import { activeProvider, generateJson, toAiError } from "@/lib/ai/provider";
import { profileText, whiskyCard } from "@/lib/ai/recommend";
import { formatKrw, STANCE_LABELS_KO, stanceFor, type PriceStance } from "@/lib/price/stats";
import type { PriceSummary } from "@/lib/price/types";
import { STORE_LABELS_KO } from "@/data/stores";
import { matchPercent, type ScoredWhisky } from "@/lib/whisky/recommend";
import type { TasteProfile, Whisky } from "@/lib/whisky/types";

/**
 * "이 값이면 살 만한가?" 판정.
 *
 * 가격 자체는 AI 가 만들지 않아요 — 사용자 제보에서 계산한 숫자예요.
 * AI 가 하는 일은 그 숫자를 **읽어주는 것**이에요: 사전에 적힌 시세 범위와
 * 비교해서 어떤 값인지, 그리고 비슷한 예산이면 이 사람 취향에 더 맞는 병이
 * 있는지. 키가 없으면 규칙 기반으로 같은 판정을 해요.
 */

export interface PriceVerdict {
  stance: PriceStance;
  headline: string;
  reason: string;
  /** 비슷한 예산에서 취향에 더 맞을 수 있는 병 */
  alternatives: { whiskyId: string; why: string }[];
  generatedBy: "ai" | "fallback";
  provider: string | null;
  model: string | null;
}

const SYSTEM_PROMPT = `당신은 한국에서 위스키를 사려는 초보자에게 "이 가격이면 살 만한지" 알려주는 도우미예요.

원칙:
- 가격은 **사용자들이 제보한 실제 목격 가격**이에요. 당신이 가격을 만들어내면 안 돼요. 주어진 숫자만 쓰세요.
- 사전에 적힌 국내 시세 범위와 비교해서 판정해요. 범위보다 낮으면 good, 안쪽이면 fair, 높으면 high.
- 제보 수가 적거나(2건 이하) 오래됐으면 그 사실을 reason 에 꼭 적어요. "제보가 1건뿐이라 참고만 해주세요" 처럼.
- 대안은 **주어진 후보 목록 안에서만** 골라요. 비슷한 예산이면서 이 사람 취향에 더 맞는 병 위주로, 최대 2개. 마땅한 게 없으면 빈 배열.
- 한국어 ~해요체, 위스키 전문 용어는 쓰지 않거나 쉬운 말을 붙여요.
- headline 은 20자 이내. reason 은 2~3문장.`;

function summaryText(summary: PriceSummary): string {
  const stores = summary.byStore
    .map((s) => `${STORE_LABELS_KO[s.store] ?? s.store} ${formatKrw(s.medianPer700)} (${s.count}건, 최근 ${s.latestSeenOn})`)
    .join(" / ");
  return [
    `제보 ${summary.count}건 (최근 90일 안 ${summary.freshCount}건), 가장 최근 제보 ${summary.latestSeenOn}`,
    `700ml 기준 중간값 ${formatKrw(summary.medianPer700)} (최저 ${formatKrw(summary.minPer700)} ~ 최고 ${formatKrw(summary.maxPer700)})`,
    `매장별: ${stores}`,
  ].join("\n");
}

export async function judgePrice(input: {
  whisky: Whisky;
  summary: PriceSummary;
  profile: TasteProfile | null;
  candidates: ScoredWhisky[];
}): Promise<PriceVerdict> {
  const provider = activeProvider();
  const fallback = fallbackVerdict(input);
  if (!provider) return fallback;

  const ids = input.candidates.map((c) => c.whisky.id);
  const Schema = z.object({
    stance: z.enum(["good", "fair", "high"]),
    headline: z.string().describe("한 줄 판정. 20자 이내. 예: '지금 사도 괜찮은 값이에요'"),
    reason: z.string().describe("왜 그런지 2~3문장. 제보 수가 적거나 오래되면 그 사실을 꼭 적어요."),
    alternatives: z
      .array(
        z.object({
          whiskyId: z.string().describe("후보 목록의 id 를 그대로."),
          why: z.string().describe("이 병을 권하는 이유 한 문장."),
        }),
      )
      .max(2)
      .describe("비슷한 예산에서 취향에 더 맞을 병. 마땅한 게 없으면 빈 배열."),
  });

  const userText = [
    `## 보고 있는 병\n${whiskyCard(input.whisky, input.profile ? matchPercent(input.profile, input.whisky) : null)}`,
    `## 제보된 시세\n${summaryText(input.summary)}`,
    input.profile ? `## 사용자 취향\n${profileText(input.profile)}` : "## 사용자 취향\n(아직 취향 진단을 안 했어요)",
    `## 대안 후보 (이 안에서만 골라요)\n${input.candidates
      .map((c) => whiskyCard(c.whisky, input.profile ? c.percent : null))
      .join("\n")}`,
  ].join("\n\n");

  try {
    const { data, model } = await generateJson({
      system: SYSTEM_PROMPT,
      user: userText,
      schema: Schema,
      schemaName: "price_verdict",
      maxTokens: 4096,
      effort: "low",
    });

    return {
      stance: data.stance,
      headline: data.headline,
      reason: data.reason,
      // 사전에 실제로 있는 id 만 받아들여요 (지어낸 id 는 버려요)
      alternatives: data.alternatives.filter((a) => ids.includes(a.whiskyId.trim())),
      generatedBy: "ai",
      provider: provider.label,
      model,
    };
  } catch (error) {
    const aiError = toAiError(error);
    console.warn(`[ai/price] ${provider.id} 실패 (${aiError.kind}): ${aiError.message}`);
    return fallback;
  }
}

/** 키가 없거나 호출이 실패했을 때 — 같은 판정을 규칙으로 해요 */
export function fallbackVerdict(input: {
  whisky: Whisky;
  summary: PriceSummary;
  candidates: ScoredWhisky[];
}): PriceVerdict {
  const stance = stanceFor(input.summary.medianPer700, input.whisky.priceKrw);
  const [low, high] = input.whisky.priceKrw;
  const thin = input.summary.count <= 2;

  const reason = [
    stance === "good"
      ? `사전에 적힌 국내 시세는 ${formatKrw(low)}~${formatKrw(high)}인데, 제보된 중간값이 그보다 낮아요.`
      : stance === "high"
        ? `사전에 적힌 국내 시세는 ${formatKrw(low)}~${formatKrw(high)}인데, 제보된 중간값이 그보다 높아요.`
        : `사전에 적힌 국내 시세 ${formatKrw(low)}~${formatKrw(high)} 안쪽이에요.`,
    thin
      ? `아직 제보가 ${input.summary.count}건뿐이라 참고만 해주세요.`
      : `제보 ${input.summary.count}건을 중간값으로 계산했어요.`,
  ].join(" ");

  return {
    stance,
    headline: STANCE_LABELS_KO[stance],
    reason,
    alternatives: input.candidates.slice(0, 2).map((c) => ({
      whiskyId: c.whisky.id,
      why: `취향 적합도 ${c.percent}%예요.`,
    })),
    generatedBy: "fallback",
    provider: null,
    model: null,
  };
}
