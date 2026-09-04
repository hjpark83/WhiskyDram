import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, getAnthropic } from "@/lib/ai/client";
import { profileText, whiskyCard } from "@/lib/ai/recommend";
import { getWhisky, WHISKIES } from "@/data/whiskies";
import {
  formatPriceRange,
  getOrigin,
  ORIGIN_LABELS_KO,
  STYLE_LABELS_KO,
  TYPE_SHORT_KO,
} from "@/lib/whisky/format";
import { hasProfile, matchPercent } from "@/lib/whisky/recommend";
import {
  STYLE_TAGS,
  type Origin,
  type StyleTag,
  type TasteProfile,
  type Whisky,
  type WhiskyType,
} from "@/lib/whisky/types";

// ---------------------------------------------------------------------------
// 클라이언트로 흘려보내는 이벤트
// ---------------------------------------------------------------------------

export interface ChatWhiskySummary {
  id: string;
  nameKo: string;
  name: string;
  typeLabel: string;
  origin: string;
  price: string;
  abv: number;
  styles: StyleTag[];
  percent: number | null;
}

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; label: string }
  | { type: "whiskies"; items: ChatWhiskySummary[] }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  profile: TasteProfile | null;
  recentNotes: { whiskyNameKo: string; rating: number; review: string }[];
}

// ---------------------------------------------------------------------------
// 도구
// ---------------------------------------------------------------------------

const ORIGINS: Origin[] = ["scotch", "irish", "japanese", "american", "korean", "other"];
const TYPES: WhiskyType[] = ["single_malt", "blended_scotch", "bourbon", "rye", "irish", "japanese", "other"];

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_whiskies",
    description:
      "위스키 사전(312병, 국내 유통 위주)에서 조건에 맞는 병을 찾아요. 병 이름을 언급하기 전에 반드시 이 도구로 확인하세요. 음식 이름(예: 삼겹살, 초콜릿)을 query 에 넣으면 어울리는 안주 정보도 검색돼요.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "자유 검색어. 이름·증류소·향 표현·음식 등. 선택." },
        origin: { type: "string", enum: ORIGINS, description: "원산지 필터. 선택." },
        type: { type: "string", enum: TYPES, description: "종류 필터. 선택." },
        styles: {
          type: "array",
          items: { type: "string", enum: [...STYLE_TAGS] },
          description: "스타일 태그(모두 만족). sherry=셰리, peated=피트(연기), bourbon_cask, wine_cask, high_proof=50%+, highball=하이볼용.",
        },
        peat: {
          type: "string",
          enum: ["none", "light", "heavy"],
          description: "연기 향 선호. none=연기 없음(0~1), light=은은(2~3), heavy=강함(4~5).",
        },
        minPriceKrw: { type: "integer", description: "최소 가격(원). 선택." },
        maxPriceKrw: { type: "integer", description: "최대 가격(원). '5만 원대'면 60000 정도로." },
        maxDifficulty: { type: "integer", minimum: 1, maximum: 5, description: "초보자면 2 이하 권장." },
        sortBy: {
          type: "string",
          enum: ["match", "price_asc", "price_desc", "easy"],
          description: "정렬. 취향 프로필이 있으면 match 기본.",
        },
        limit: { type: "integer", minimum: 1, maximum: 10, description: "기본 6." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_whisky_details",
    description: "특정 병의 상세 정보(향·맛·여운, 초보자 팁, 안주, 취향 적합도)를 가져와요. id 는 search_whiskies 결과의 id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

interface SearchInput {
  query?: string;
  origin?: Origin;
  type?: WhiskyType;
  styles?: StyleTag[];
  peat?: "none" | "light" | "heavy";
  minPriceKrw?: number;
  maxPriceKrw?: number;
  maxDifficulty?: number;
  sortBy?: "match" | "price_asc" | "price_desc" | "easy";
  limit?: number;
}

function summarize(w: Whisky, profile: TasteProfile | null): ChatWhiskySummary {
  return {
    id: w.id,
    nameKo: w.nameKo,
    name: w.name,
    typeLabel: TYPE_SHORT_KO[w.type],
    origin: ORIGIN_LABELS_KO[getOrigin(w)],
    price: formatPriceRange(w.priceKrw),
    abv: w.abv,
    styles: w.styles,
    percent: profile ? matchPercent(profile, w) : null,
  };
}

function searchWhiskies(input: SearchInput, profile: TasteProfile | null) {
  const tokens = (input.query ?? "")
    .toLowerCase()
    .split(/[\s,·/]+/)
    .filter((t) => t.length >= 1);
  let list = WHISKIES.filter((w) => {
    if (input.origin && getOrigin(w) !== input.origin) return false;
    if (input.type && w.type !== input.type) return false;
    if (input.styles?.length && !input.styles.every((s) => w.styles.includes(s))) return false;
    if (input.peat === "none" && w.flavor.peat > 1) return false;
    if (input.peat === "light" && (w.flavor.peat < 2 || w.flavor.peat > 3)) return false;
    if (input.peat === "heavy" && w.flavor.peat < 4) return false;
    if (input.minPriceKrw && w.priceKrw[1] < input.minPriceKrw) return false;
    if (input.maxPriceKrw && w.priceKrw[0] > input.maxPriceKrw) return false;
    if (input.maxDifficulty && w.difficulty > input.maxDifficulty) return false;
    if (tokens.length) {
      const hay = [
        w.nameKo, w.name, w.distillery, w.country, ...(w.aliases ?? []),
        ...w.pairings, w.notes.nose, w.notes.palate, w.notes.finish, w.beginnerTip,
        ...w.styles.map((s) => STYLE_LABELS_KO[s]),
      ]
        .join(" ")
        .toLowerCase();
      // 토큰 중 하나라도 맞으면 포함하되, 많이 맞을수록 앞으로
      const hits = tokens.filter((t) => hay.includes(t)).length;
      if (hits === 0) return false;
      (w as Whisky & { _hits?: number })._hits = hits;
    }
    return true;
  });

  const sortBy = input.sortBy ?? (hasProfile(profile) ? "match" : "easy");
  list = [...list].sort((a, b) => {
    const ha = (a as Whisky & { _hits?: number })._hits ?? 0;
    const hb = (b as Whisky & { _hits?: number })._hits ?? 0;
    if (tokens.length && hb !== ha) return hb - ha;
    switch (sortBy) {
      case "match":
        return (profile ? (matchPercent(profile, b) ?? 0) - (matchPercent(profile, a) ?? 0) : 0) || a.difficulty - b.difficulty;
      case "price_asc":
        return a.priceKrw[0] - b.priceKrw[0];
      case "price_desc":
        return b.priceKrw[0] - a.priceKrw[0];
      default:
        return a.difficulty - b.difficulty || a.priceKrw[0] - b.priceKrw[0];
    }
  });

  const limit = Math.min(10, Math.max(1, input.limit ?? 6));
  const picked = list.slice(0, limit);
  const text =
    picked.length === 0
      ? "조건에 맞는 병이 없어요. 조건을 완화해서 다시 검색해보세요."
      : picked
          .map((w) => {
            const pct = profile ? matchPercent(profile, w) : null;
            return `- [${w.id}] ${w.nameKo} (${w.name}) · ${TYPE_SHORT_KO[w.type]} · ${w.abv}% · ${formatPriceRange(w.priceKrw)} · 난이도 ${w.difficulty}/5${pct !== null ? ` · 취향 ${pct}%` : ""}${w.styles.length ? ` · ${w.styles.map((s) => STYLE_LABELS_KO[s]).join(",")}` : ""}\n  향: ${w.notes.nose} / 안주: ${w.pairings.join(", ")}`;
          })
          .join("\n") + `\n(총 ${list.length}병 중 ${picked.length}병)`;
  return { text, items: picked.map((w) => summarize(w, profile)) };
}

function executeTool(
  name: string,
  input: unknown,
  ctx: ChatContext,
): { text: string; items: ChatWhiskySummary[]; label: string } {
  if (name === "search_whiskies") {
    const i = (input ?? {}) as SearchInput;
    const r = searchWhiskies(i, ctx.profile);
    const label = i.query ? `"${i.query}" 검색 중` : "사전 검색 중";
    return { ...r, label };
  }
  if (name === "get_whisky_details") {
    const { id } = (input ?? {}) as { id?: string };
    const w = id ? getWhisky(id) : undefined;
    if (!w) return { text: "그 id 의 병이 없어요.", items: [], label: "상세 조회 중" };
    const pct = ctx.profile ? matchPercent(ctx.profile, w) : null;
    return { text: whiskyCard(w, pct), items: [summarize(w, ctx.profile)], label: `${w.nameKo} 살펴보는 중` };
  }
  return { text: "알 수 없는 도구예요.", items: [], label: "처리 중" };
}

// ---------------------------------------------------------------------------
// 시스템 프롬프트
// ---------------------------------------------------------------------------

const BASE_PROMPT = `당신은 FirstDram 의 AI 소믈리에예요. 위스키를 처음 시작하는 한국인과 대화해요.

원칙:
- 한국어, 부드러운 ~해요체. 친구처럼 짧게. 답변은 보통 3~6문장, 병 추천은 최대 3병.
- 전문 용어는 쓰지 않거나 괄호로 쉬운 말을 붙여요. 예: 피트(모닥불 같은 연기 향).
- 병 이름을 말하기 전에 반드시 search_whiskies 로 사전에서 확인해요. 사전에 없는 병은 추천하지 않아요. 사전 밖 질문(역사, 마시는 법 등)은 도구 없이 답해도 돼요.
- 추천할 때는 이유를 사용자의 상황(음식, 예산, 취향 프로필, 이전 후기)과 연결해요. 가격은 사전의 범위를 그대로.
- 사용자에게 되묻는 건 꼭 필요할 때만 한 가지.
- 마크다운 헤더·표는 쓰지 말고, 병 이름은 **굵게**, 목록은 "-" 로만.
- 위스키 외 주제로 빠지면 부드럽게 위스키로 돌아와요. 미성년자 음주·과음은 권하지 않아요.`;

function buildSystemPrompt(ctx: ChatContext): string {
  const parts = [BASE_PROMPT, ""];
  if (ctx.profile && hasProfile(ctx.profile)) {
    parts.push("## 사용자 취향 프로필", profileText(ctx.profile), "");
  } else {
    parts.push("## 사용자 취향 프로필", "아직 없어요. 자연스럽게 취향 진단(/quiz)을 권해도 좋아요.", "");
  }
  if (ctx.recentNotes.length) {
    parts.push(
      "## 최근 후기",
      ...ctx.recentNotes.map((n) => `- ${n.whiskyNameKo} ${"★".repeat(n.rating)}: ${n.review}`),
      "",
    );
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// 대화 실행 (스트리밍 이벤트 제너레이터)
// ---------------------------------------------------------------------------

const MAX_TOOL_ROUNDS = 5;

export async function* runChat(turns: ChatTurn[], ctx: ChatContext): AsyncGenerator<ChatEvent> {
  const client = getAnthropic();
  if (!client) {
    yield {
      type: "error",
      message: "지금은 AI 소믈리에를 부를 수 없어요 (API 키 없음). 위스키 탐색에서 직접 찾아보세요.",
    };
    return;
  }

  const messages: Anthropic.MessageParam[] = turns
    .filter((t) => t.content.trim())
    .map((t) => ({ role: t.role, content: t.content }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    yield { type: "error", message: "질문을 입력해주세요." };
    return;
  }

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: buildSystemPrompt(ctx), cache_control: { type: "ephemeral" } },
  ];

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        output_config: { effort: "low" },
        system,
        tools: TOOLS,
        messages,
      });

      const queue: string[] = [];
      stream.on("text", (delta) => queue.push(delta));

      // finalMessage 를 기다리는 동안 텍스트를 흘려보내요
      const finalPromise = stream.finalMessage();
      let settled = false;
      finalPromise.then(() => (settled = true), () => (settled = true));
      while (!settled) {
        while (queue.length) yield { type: "text", text: queue.shift()! };
        await new Promise((r) => setTimeout(r, 40));
      }
      while (queue.length) yield { type: "text", text: queue.shift()! };

      const message = await finalPromise;

      if (message.stop_reason === "refusal") {
        yield { type: "error", message: "그 질문에는 답하기 어려워요. 위스키 이야기로 돌아와볼까요?" };
        return;
      }
      if (message.stop_reason !== "tool_use") break;

      const toolUses = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      messages.push({ role: "assistant", content: message.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const r = executeTool(tu.name, tu.input, ctx);
        yield { type: "tool", label: r.label };
        if (r.items.length) yield { type: "whiskies", items: r.items };
        results.push({ type: "tool_result", tool_use_id: tu.id, content: r.text });
      }
      messages.push({ role: "user", content: results });
    }
    yield { type: "done" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      yield { type: "error", message: "지금 요청이 많아요. 잠시 후 다시 물어봐 주세요." };
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[ai/chat] API error ${error.status}: ${error.message}`);
      yield { type: "error", message: "AI 소믈리에가 잠시 자리를 비웠어요. 다시 시도해주세요." };
    } else {
      console.error("[ai/chat] unexpected error", error);
      yield { type: "error", message: "문제가 생겼어요. 다시 시도해주세요." };
    }
  }
}
