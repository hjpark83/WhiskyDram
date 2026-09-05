import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { geminiKey } from "@/lib/ai/gemini";
import { activeProvider, AiError, toAiError, type ProviderInfo } from "@/lib/ai/provider";

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

export async function researchWeb(prompt: string): Promise<ResearchResult> {
  const provider = activeProvider();
  if (!provider) throw new AiError("AI 프로바이더가 설정되지 않았어요.", "auth");
  if (provider.id === "gemini") return researchGemini(prompt, provider);
  if (provider.id === "openai") return researchOpenAi(prompt, provider);
  return researchAnthropic(prompt, provider);
}

// ── Gemini: google_search 그라운딩 (네이티브 REST) ───────────────────────────

async function researchGemini(prompt: string, provider: ProviderInfo): Promise<ResearchResult> {
  const key = geminiKey();
  if (!key) throw new AiError("GEMINI_API_KEY 가 없어요.", "auth");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,
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
    throw new AiError(`Gemini 검색 실패: ${detail.slice(0, 300)}`, res.status === 429 ? "rate_limit" : "other", res.status);
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
