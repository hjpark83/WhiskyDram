import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { z } from "zod";
import { geminiGenerateJson, geminiKey, geminiStreamTurn } from "@/lib/ai/gemini";
import {
  AiError,
  type AiProviderId,
  type AiTurn,
  type JsonRequest,
  type JsonResponse,
  type ProviderInfo,
  type StreamRequest,
  type StreamResult,
} from "@/lib/ai/provider-shared";

/**
 * AI 프로바이더 어댑터.
 *
 * 이 앱의 AI 기능(취향 추천 · 후기 분석 · 병 스캔 · 소믈리에 채팅)은 모두
 *  1) 스키마가 정해진 JSON 을 받아오거나 (generateJson)
 *  2) 도구를 쓰면서 글자를 흘려보내거나 (streamTurn)
 * 둘 중 하나예요. 그래서 이 두 함수만 프로바이더별로 구현하면
 * Claude / ChatGPT(OpenAI) / Gemini 를 환경변수 하나로 바꿔 쓸 수 있어요.
 *
 * 고르는 규칙
 *  - `AI_PROVIDER` 가 있으면 그걸 써요 (anthropic | openai | gemini).
 *  - 없으면 키가 있는 것 중에서 anthropic → openai → gemini 순으로 골라요.
 *  - 아무 키도 없으면 null → 각 기능이 규칙 기반 폴백으로 넘어가요 (데모가 안 멈춰요).
 *
 * Gemini 는 OpenAI 호환 경로가 아니라 **네이티브 API** 로 붙여요 (`gemini.ts`).
 * 새 `AQ.` 형식 키가 호환 경로에서 막히고, 검색 그라운딩도 거기엔 없어서예요.
 */

export * from "@/lib/ai/provider-shared";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function keyFor(id: AiProviderId): string | undefined {
  if (id === "anthropic") return env("ANTHROPIC_API_KEY");
  if (id === "openai") return env("OPENAI_API_KEY");
  return geminiKey();
}

function modelFor(id: AiProviderId): string {
  if (id === "anthropic") return env("ANTHROPIC_MODEL") ?? "claude-opus-5";
  if (id === "openai") return env("OPENAI_MODEL") ?? "gpt-5";
  return env("GEMINI_MODEL") ?? "gemini-2.5-flash";
}

const LABELS: Record<AiProviderId, string> = {
  anthropic: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
};

const ORDER: AiProviderId[] = ["anthropic", "openai", "gemini"];

/** 지금 쓸 프로바이더. 키가 하나도 없으면 null. */
export function activeProvider(): ProviderInfo | null {
  const wanted = env("AI_PROVIDER")?.toLowerCase();
  const candidates =
    wanted && ORDER.includes(wanted as AiProviderId) ? [wanted as AiProviderId] : ORDER;
  for (const id of candidates) {
    if (keyFor(id)) return { id, label: LABELS[id], model: modelFor(id) };
  }
  return null;
}

/** 설정된 프로바이더 목록 (설정 화면·문서용) */
export function configuredProviders(): ProviderInfo[] {
  return ORDER.filter((id) => keyFor(id)).map((id) => ({ id, label: LABELS[id], model: modelFor(id) }));
}

// ── 클라이언트 ──────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
let openAiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  anthropicClient ??= new Anthropic({ apiKey: keyFor("anthropic"), timeout: 60_000, maxRetries: 1 });
  return anthropicClient;
}

function getOpenAiClient(): OpenAI {
  openAiClient ??= new OpenAI({ apiKey: keyFor("openai"), timeout: 60_000, maxRetries: 1 });
  return openAiClient;
}

// ── 오류 ────────────────────────────────────────────────────────────────────

/** 어느 SDK 오류든 하나의 모양으로 */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.APIError || error instanceof OpenAI.APIError) {
    const status = error.status ?? undefined;
    const kind = status === 429 ? "rate_limit" : status === 401 || status === 403 ? "auth" : "other";
    return new AiError(error.message, kind, status);
  }
  return new AiError(error instanceof Error ? error.message : String(error), "other");
}

// ── 1) 구조화 JSON ──────────────────────────────────────────────────────────

/**
 * OpenAI 의 strict 모드는 스키마 키워드를 좁게 받아요 (배열 길이·숫자 범위 불가).
 * 그래서 JSON Schema 에서는 그 키를 떼고, 값 검증은 zod 로 한 번 더 해요.
 */
function stripUnsupportedKeywords(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupportedKeywords);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (
      ["minItems", "maxItems", "minimum", "maximum", "multipleOf", "minLength", "maxLength", "pattern", "format", "$schema"].includes(
        key,
      )
    ) {
      continue;
    }
    out[key] = stripUnsupportedKeywords(value);
  }
  return out;
}

export async function generateJson<T>(req: JsonRequest<T>): Promise<JsonResponse<T>> {
  const provider = activeProvider();
  if (!provider) throw new AiError("AI 프로바이더가 설정되지 않았어요.", "auth");

  if (provider.id === "anthropic") return generateJsonAnthropic(req, provider);
  if (provider.id === "openai") return generateJsonOpenAi(req, provider);

  const { data, model } = await geminiGenerateJson({
    model: provider.model,
    system: req.system,
    user: req.user,
    images: req.images,
    schema: req.schema,
    maxTokens: req.maxTokens,
  });
  return { data, model, provider: provider.id };
}

async function generateJsonAnthropic<T>(req: JsonRequest<T>, provider: ProviderInfo): Promise<JsonResponse<T>> {
  const client = getAnthropicClient();
  const content: Anthropic.ContentBlockParam[] = [];
  for (const image of req.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType as "image/jpeg", data: image.base64 },
    });
  }
  content.push({ type: "text", text: req.user });

  const response = await client.messages.parse({
    model: provider.model,
    max_tokens: req.maxTokens ?? 4096,
    output_config: { effort: req.effort ?? "medium", format: zodOutputFormat(req.schema) },
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new AiError("모델이 응답을 거부했어요.", "refusal");
  }
  if (!response.parsed_output) {
    throw new AiError("구조화된 응답을 받지 못했어요.", "other");
  }
  return { data: response.parsed_output as T, model: response.model, provider: provider.id };
}

async function generateJsonOpenAi<T>(req: JsonRequest<T>, provider: ProviderInfo): Promise<JsonResponse<T>> {
  const client = getOpenAiClient();
  const schema = stripUnsupportedKeywords(
    z.toJSONSchema(req.schema as z.ZodType<unknown>, { target: "draft-7", io: "output" }),
  ) as Record<string, unknown>;

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  for (const image of req.images ?? []) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
    });
  }
  userContent.push({ type: "text", text: req.user });

  const call = (format: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"], system: string) =>
    client.chat.completions.create({
      model: provider.model,
      max_completion_tokens: req.maxTokens ?? 4096,
      response_format: format,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    });

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await call(
      { type: "json_schema", json_schema: { name: req.schemaName, schema, strict: true } },
      req.system,
    );
  } catch (error) {
    // 스키마 모드를 못 받는 모델이 있어요. 그때는 JSON 모드로 한 번 더.
    const err = toAiError(error);
    if (err.status !== 400) throw err;
    console.warn(`[ai/provider] openai: json_schema 실패, json_object 로 재시도 — ${err.message}`);
    completion = await call(
      { type: "json_object" },
      `${req.system}\n\n반드시 아래 JSON 스키마에 맞는 JSON 객체만 출력하세요. 설명·코드블록 없이 JSON 만.\n${JSON.stringify(schema)}`,
    );
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new AiError("빈 응답을 받았어요.", "other");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiError("JSON 을 해석할 수 없었어요.", "other");
  }
  const parsed = req.schema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError(`응답이 스키마와 맞지 않아요: ${parsed.error.issues[0]?.message ?? ""}`, "other");
  }
  return { data: parsed.data, model: completion.model, provider: provider.id };
}

// ── 2) 도구를 쓰는 스트리밍 한 턴 ────────────────────────────────────────────

/**
 * 한 턴을 스트리밍으로 받아요. 도구 호출이 있으면 toolCalls 가 채워지고,
 * 호출부가 결과를 붙여 다시 부르는 방식(툴 루프)이에요.
 */
export async function streamTurn(req: StreamRequest): Promise<StreamResult> {
  const provider = activeProvider();
  if (!provider) throw new AiError("AI 프로바이더가 설정되지 않았어요.", "auth");

  if (provider.id === "anthropic") return streamTurnAnthropic(req, provider);
  if (provider.id === "openai") return streamTurnOpenAi(req, provider);
  return geminiStreamTurn({ ...req, model: provider.model });
}

function toAnthropicMessages(turns: AiTurn[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const turn of turns) {
    if (turn.role === "user") {
      out.push({ role: "user", content: turn.text });
    } else if (turn.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (turn.text) blocks.push({ type: "text", text: turn.text });
      for (const call of turn.toolCalls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      if (blocks.length) out.push({ role: "assistant", content: blocks });
    } else {
      out.push({
        role: "user",
        content: turn.results.map<Anthropic.ToolResultBlockParam>((r) => ({
          type: "tool_result",
          tool_use_id: r.id,
          content: r.content,
        })),
      });
    }
  }
  return out;
}

async function streamTurnAnthropic(req: StreamRequest, provider: ProviderInfo): Promise<StreamResult> {
  const client = getAnthropicClient();
  const stream = client.messages.stream({
    model: provider.model,
    max_tokens: req.maxTokens ?? 2048,
    output_config: { effort: "low" },
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    tools: req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
    })),
    messages: toAnthropicMessages(req.turns),
  });

  stream.on("text", (delta) => req.onText(delta));
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new AiError("모델이 응답을 거부했어요.", "refusal");

  return {
    text: message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(""),
    toolCalls: message.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input })),
    model: message.model,
  };
}

function toOpenAiMessages(system: string, turns: AiTurn[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: system }];
  for (const turn of turns) {
    if (turn.role === "user") {
      out.push({ role: "user", content: turn.text });
    } else if (turn.role === "assistant") {
      out.push({
        role: "assistant",
        content: turn.text || null,
        ...(turn.toolCalls.length > 0 && {
          tool_calls: turn.toolCalls.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
          })),
        }),
      });
    } else {
      // OpenAI 는 결과를 하나씩 따로 보내요
      for (const r of turn.results) {
        out.push({ role: "tool", tool_call_id: r.id, content: r.content });
      }
    }
  }
  return out;
}

async function streamTurnOpenAi(req: StreamRequest, provider: ProviderInfo): Promise<StreamResult> {
  const client = getOpenAiClient();
  const stream = await client.chat.completions.create({
    model: provider.model,
    max_completion_tokens: req.maxTokens ?? 2048,
    stream: true,
    messages: toOpenAiMessages(req.system, req.turns),
    tools: req.tools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    })),
  });

  let text = "";
  let model = provider.model;
  // 도구 호출은 조각으로 나눠 와요. index 로 모아요.
  const partial = new Map<number, { id: string; name: string; args: string }>();

  for await (const chunk of stream) {
    if (chunk.model) model = chunk.model;
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    if (typeof delta.content === "string" && delta.content) {
      text += delta.content;
      req.onText(delta.content);
    }
    for (const call of delta.tool_calls ?? []) {
      const slot = partial.get(call.index) ?? { id: "", name: "", args: "" };
      if (call.id) slot.id = call.id;
      if (call.function?.name) slot.name = call.function.name;
      if (call.function?.arguments) slot.args += call.function.arguments;
      partial.set(call.index, slot);
    }
  }

  const toolCalls: StreamResult["toolCalls"] = [];
  for (const [index, slot] of [...partial.entries()].sort((a, b) => a[0] - b[0])) {
    if (!slot.name) continue;
    let input: unknown = {};
    try {
      input = slot.args ? JSON.parse(slot.args) : {};
    } catch {
      console.warn(`[ai/provider] 도구 인자를 해석 못했어요: ${slot.name} ${slot.args}`);
    }
    toolCalls.push({ id: slot.id || `call_${index}`, name: slot.name, input });
  }

  return { text, toolCalls, model };
}
