import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { geminiBase, geminiKey, quotaHintFromBody } from "@/lib/ai/gemini";
import { AiError, providerChain, toAiError, type ProviderInfo } from "@/lib/ai/provider";

/**
 * "AI 가 웹에서 찾아보기".
 *
 * LLM 자체는 인터넷을 못 봐요. 대신 세 프로바이더 모두 **검색 그라운딩** 도구를 갖고 있어서,
 * 모델이 스스로 검색하고 그 결과를 근거로 답하면서 출처 URL 을 함께 돌려줘요.
 *  - Gemini : google_search (네이티브 REST. OpenAI 호환 엔드포인트에는 이 도구가 없어요)
 *  - OpenAI : Responses API 의 web_search
 *  - Claude : messages 의 web_search 서버 도구
 *
 * 캐치테이블·네이버 HTML 을 직접 긁지 않아요. 약관 문제도 있지만, 두 곳 모두 로그인·봇 차단이
 * 걸린 JS 렌더링 페이지라 서버에서 긁으면 금방 막혀요. 검색 그라운딩은 공식 경로예요.
 *
 * 돌려주는 건 "근거가 붙은 글"이지 사실 확인이 끝난 데이터가 아니에요.
 * 날짜·주소처럼 틀리면 사람이 헛걸음하는 정보는 반드시 사람이 확인하고 공개해야 해요.
 */

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchResult {
  text: string;
  sources: ResearchSource[];
  model: string;
  provider: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pushSource(out: ResearchSource[], url: unknown, title: unknown): void {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
  if (out.some((s) => s.url === url)) return;
  out.push({ url, title: typeof title === "string" && title ? title : url });
}

/**
 * 웹 검색도 프로바이더를 넘겨가며 시도해요.
 *
 * 여기가 한도에 가장 잘 걸려요 — 한 번 누르면 그라운딩 + 구조화 추출로 두 번
 * 부르고, 그라운딩 호출 자체가 무거워요. 그리고 무료 등급에서 **그라운딩만
 * 따로 막혀 있는 경우**도 있어서, 다른 프로바이더의 검색 도구로 넘어갈 수 있으면
 * 기능이 살아나요 (Claude 는 web_search, OpenAI 는 Responses API 의 web_search).
 */
export async function researchWeb(prompt: string): Promise<ResearchResult> {
  const chain = providerChain();
  if (chain.length === 0) throw new AiError("AI 프로바이더가 설정되지 않았어요.", "auth");

  let firstError: unknown = null;
  for (const [i, provider] of chain.entries()) {
    try {
      if (provider.id === "gemini") return await researchGemini(prompt, provider);
      if (provider.id === "openai") return await researchOpenAi(prompt, provider);
      return await researchAnthropic(prompt, provider);
    } catch (error) {
      firstError ??= error;
      const kind = toAiError(error).kind;
      // 한도·인증은 그 프로바이더만의 문제라 다른 곳에서는 될 수 있어요.
      // 그라운딩 미지원(400)도 프로바이더를 바꾸면 되니 같이 넘겨요.
      const status = toAiError(error).status;
      const movable = kind === "rate_limit" || kind === "auth" || status === 400;
      if (i === chain.length - 1 || !movable) throw firstError;
      console.warn(`[ai/research] ${provider.id} 실패 (${kind}) → ${chain[i + 1].id} 로 넘어가요`);
    }
  }
  throw firstError ?? new AiError("웹 검색에 실패했어요.", "other");
}

// ── Gemini: google_search 그라운딩 (네이티브 REST) ───────────────────────────

async function researchGemini(prompt: string, provider: ProviderInfo): Promise<ResearchResult> {
  const key = geminiKey();
  if (!key) throw new AiError("GEMINI_API_KEY 가 없어요.", "auth");

  const res = await fetch(
    `${geminiBase()}/models/${encodeURIComponent(provider.model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 한도(429)면 분당인지 하루인지까지 — callGemini 와 같은 안내를 써요
    const hint = res.status === 429 ? quotaHintFromBody(detail).trim().replace(/^\((.*)\)$/, "$1") : "";
    throw new AiError(
      `Gemini 검색 실패: ${hint} ${detail.slice(0, 300)}`,
      res.status === 429 ? "rate_limit" : "other",
      res.status,
      hint || undefined,
    );
  }

  const body = asRecord(await res.json());
  const candidate = asRecord((body?.candidates as unknown[] | undefined)?.[0]);
  const parts = (asRecord(candidate?.content)?.parts as unknown[] | undefined) ?? [];
  const text = parts
    .map((p) => asRecord(p)?.text)
    .filter((t): t is string => typeof t === "string")
    .join("\n");

  const sources: ResearchSource[] = [];
  const chunks = (asRecord(candidate?.groundingMetadata)?.groundingChunks as unknown[] | undefined) ?? [];
  for (const chunk of chunks) {
    const web = asRecord(asRecord(chunk)?.web);
    pushSource(sources, web?.uri, web?.title);
  }

  return { text, sources, model: provider.model, provider: provider.id };
}

// ── OpenAI: Responses API 의 web_search ─────────────────────────────────────

async function researchOpenAi(prompt: string, provider: ProviderInfo): Promise<ResearchResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 1 });
  const response = await client.responses.create({
    model: provider.model,
    tools: [{ type: "web_search" }],
    input: prompt,
  });

  const sources: ResearchSource[] = [];
  for (const item of (response.output ?? []) as unknown[]) {
    const content = (asRecord(item)?.content as unknown[] | undefined) ?? [];
    for (const block of content) {
      const annotations = (asRecord(block)?.annotations as unknown[] | undefined) ?? [];
      for (const note of annotations) {
        const n = asRecord(note);
        if (n?.type === "url_citation") pushSource(sources, n.url, n.title);
      }
    }
  }

  return {
    text: response.output_text ?? "",
    sources,
    model: response.model ?? provider.model,
    provider: provider.id,
  };
}

// ── Claude: web_search 서버 도구 ────────────────────────────────────────────

async function researchAnthropic(prompt: string, provider: ProviderInfo): Promise<ResearchResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 1 });

  // 최신 모델은 동적 필터링이 붙은 새 도구를, 예전 모델은 기본 도구를 받아요.
  const attempt = (type: "web_search_20260209" | "web_search_20250305") =>
    client.messages.create({
      model: provider.model,
      max_tokens: 8000,
      tools: [{ type, name: "web_search", max_uses: 8 } as unknown as Anthropic.ToolUnion],
      messages: [{ role: "user", content: prompt }],
    });

  let message: Anthropic.Message;
  try {
    message = await attempt("web_search_20260209");
  } catch (error) {
    const err = toAiError(error);
    if (err.status !== 400) throw err;
    message = await attempt("web_search_20250305");
  }

  const sources: ResearchSource[] = [];
  let text = "";
  for (const block of message.content as unknown[]) {
    const b = asRecord(block);
    if (b?.type === "text" && typeof b.text === "string") text += b.text;
    if (b?.type === "web_search_tool_result") {
      // 성공하면 content 가 배열, 실패하면 오류 객체 하나예요
      const results = Array.isArray(b.content) ? (b.content as unknown[]) : [];
      for (const r of results) {
        const item = asRecord(r);
        pushSource(sources, item?.url, item?.title);
      }
    }
  }

  return { text, sources, model: message.model, provider: provider.id };
}
