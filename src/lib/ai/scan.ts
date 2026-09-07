import { z } from "zod";
import { activeProvider, generateJson, toAiError } from "@/lib/ai/provider";
import { profileText } from "@/lib/ai/recommend";
import { WHISKIES } from "@/data/whiskies";
import { hasProfile, matchPercent } from "@/lib/whisky/recommend";
import type { TasteProfile } from "@/lib/whisky/types";

/** recommendations.payload (source = 'scan') 에 저장되는 형태 */
export interface ScanPayload {
  kind: "scan";
  readText: string; // 라벨에서 읽은 글자
  guessName: string; // AI 가 추정한 병 이름
  whiskyId: string | null; // 사전 매칭 결과
  confidence: "high" | "medium" | "low";
  alternatives: string[]; // 헷갈릴 수 있는 다른 사전 id
  verdict: {
    headline: string;
    reason: string;
    howToDrink: string;
    caution: string | null;
  } | null;
  percent: number | null;
  generatedBy: "ai" | "fallback";
  model: string | null;
  /** 어떤 AI 로 읽었는지 (Claude / ChatGPT / Gemini). 폴백이면 null. */
  provider?: string | null;
}

// 사전 목록은 매 요청 같으니 시스템 프롬프트에 넣고 캐시해요.
const CATALOG = WHISKIES.map(
  (w) => `${w.id} | ${w.nameKo} | ${w.name}${w.aliases?.length ? ` | ${w.aliases.join(", ")}` : ""}`,
).join("\n");

const SYSTEM_PROMPT = `당신은 위스키 라벨을 읽고 사전에서 같은 병을 찾아주는 도우미예요.

절차:
1. 사진 속 라벨의 브랜드, 제품명, 숙성 연수, 특별 에디션 표기를 읽어요.
2. 아래 사전 목록에서 가장 잘 맞는 id 를 골라요. 숙성 연수·에디션까지 맞아야 high, 브랜드만 맞으면 medium, 애매하면 low.
3. 사전에 없는 병이면 whiskyId 를 "unknown" 으로 두고, 읽은 이름을 guessName 에 적어요.
4. 사용자의 취향 프로필이 있으면 그 병이 지금 취향에 맞는지 짧게 판정해요. 한국어 ~해요체, 전문 용어 없이.

## 사전 (id | 한글 이름 | 영문 이름 | 별칭)
${CATALOG}`;

export interface ScanInput {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  profile: TasteProfile | null;
}

export async function scanBottle(input: ScanInput): Promise<ScanPayload> {
  const provider = activeProvider();
  if (!provider) return fallbackScan();

  const personalized = hasProfile(input.profile);

  const Schema = z.object({
    readText: z.string().describe("라벨에서 읽은 글자 그대로. 못 읽으면 빈 문자열."),
    guessName: z.string().describe("추정한 병 이름 (한글 또는 영문)."),
    // 사전 id 를 enum 으로 넘기지 않아요.
    // 사전이 크고 id 가 두 곳(whiskyId, alternatives)에 들어가서, enum 으로 만들면
    // Gemini responseSchema 한도를 넘어 400 (invalid argument) 이 나요.
    // 목록은 이미 시스템 프롬프트에 있으니 모델은 문자열로 답하고,
    // 진짜 있는 id 인지는 아래에서 코드가 대조해요 (지어내도 안전해요).
    whiskyId: z.string().describe('사전 목록의 id 를 그대로. 사전에 없으면 "unknown".'),
    confidence: z.enum(["high", "medium", "low"]),
    alternatives: z
      .array(z.string())
      .max(3)
      .describe("헷갈릴 수 있는 다른 사전 id (같은 브랜드의 다른 연수 등). 없으면 빈 배열."),
    verdict: z
      .object({
        headline: z.string().describe("한 줄 판정. 예: '지금 취향에 딱 맞아요', '조금 도전적인 선택'. 15자 이내."),
        reason: z.string().describe("왜 그런지 2문장. 취향 프로필의 축을 근거로."),
        howToDrink: z.string().describe("이 병을 처음 마실 때 추천 방법. 1문장."),
        caution: z.string().nullable().describe("주의점 한 문장, 없으면 null."),
      })
      .nullable()
      .describe("사전에서 찾았을 때만. unknown 이면 null."),
  });

  const userText = personalized
    ? `## 사용자 취향 프로필\n${profileText(input.profile!)}\n\n이 병을 찾고, 지금 취향에 맞는지 판정해주세요.`
    : "이 병을 사전에서 찾아주세요. 취향 프로필이 아직 없으니 verdict 는 초보자에게 어떤 병인지 일반적인 설명으로 채워주세요.";

  try {
    const { data: out, model } = await generateJson({
      system: SYSTEM_PROMPT,
      user: userText,
      images: [{ mediaType: input.mediaType, base64: input.imageBase64 }],
      schema: Schema,
      schemaName: "bottle_scan",
      // Gemini 3.x 등 생각하는 모델은 **생각에도 출력 예산을 써요**.
      // 2048 이면 사전(수백 병) + 이미지가 들어간 이 요청에선 답이 비어버려요
      // (finishReason: MAX_TOKENS → 폴백). 넉넉하게 둬요.
      maxTokens: 8192,
      effort: "medium",
    });

    // 사전에 **실제로 있는** id 만 받아들여요. 모델이 그럴듯한 id 를 지어내도
    // 여기서 걸러지고 unknown 으로 떨어져요.
    const whisky = WHISKIES.find((w) => w.id === out.whiskyId.trim());
    const whiskyId = whisky?.id ?? null;
    const percent = whisky && input.profile ? matchPercent(input.profile, whisky) : null;

    return {
      kind: "scan",
      readText: out.readText,
      guessName: out.guessName,
      whiskyId,
      confidence: out.confidence,
      alternatives: out.alternatives
        .map((a) => a.trim())
        .filter((a) => a !== whiskyId && WHISKIES.some((w) => w.id === a)),
      verdict: whisky ? out.verdict : null,
      percent,
      generatedBy: "ai",
      model,
      provider: provider.label,
    };
  } catch (error) {
    const err = toAiError(error);
    console.error(`[ai/scan] ${provider.id} 실패 (${err.kind}): ${err.message}`);
    return fallbackScan();
  }
}

function fallbackScan(): ScanPayload {
  return {
    kind: "scan",
    readText: "",
    guessName: "",
    whiskyId: null,
    confidence: "low",
    alternatives: [],
    verdict: null,
    percent: null,
    generatedBy: "fallback",
    model: null,
  };
}
