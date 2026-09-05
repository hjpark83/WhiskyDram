import { z } from "zod";
import { AiError } from "@/lib/ai/provider-shared";
import type { AiImage, AiToolDef, AiTurn, StreamResult } from "@/lib/ai/provider-shared";

/**
 * Gemini 는 **네이티브 API** 로 부릅니다 (OpenAI 호환 경로가 아니라).
 *
 * 왜냐면:
 *  - 새로 발급되는 `AQ.` 형식 키는 네이티브 엔드포인트에서만 확실히 동작해요.
 *    OpenAI 호환 경로(`/v1beta/openai/`)에서 401 이 난다는 보고가 많아요.
 *  - google_search 그라운딩 같은 기능이 호환 경로에는 아예 없어요.
 *
 * 그래서 구조화 출력·툴 스트리밍·웹 검색을 모두 여기서 REST 로 처리해요.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export function geminiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return key || undefined;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: unknown };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function callGemini(
  model: string,
  method: "generateContent" | "streamGenerateContent",
  body: Record<string, unknown>,
  { sse = false }: { sse?: boolean } = {},
): Promise<Response> {
  const key = geminiKey();
  if (!key) throw new AiError("GEMINI_API_KEY 가 없어요.", "auth");

  const url = `${BASE}/models/${encodeURIComponent(model)}:${method}${sse ? "?alt=sse" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 400);
    const kind =
      res.status === 429 ? "rate_limit" : res.status === 401 || res.status === 403 ? "auth" : "other";
    // 404 는 거의 항상 모델 이름 오타예요 — 무엇을 고쳐야 하는지 바로 알려줘요
    const hint =
      res.status === 404
        ? ` (GEMINI_MODEL="${model}" 이름을 확인해주세요)`
        : res.status === 401 || res.status === 403
          ? " (GEMINI_API_KEY 를 확인해주세요)"
          : "";
    throw new AiError(`Gemini ${res.status}${hint}: ${detail}`, kind, res.status);
  }
  return res;
}

// ── 스키마 변환 ─────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
  object: "OBJECT",
};

/**
 * JSON Schema(zod 가 뱉는 draft-7) → Gemini 스키마(OpenAPI 3.0 부분집합).
 * Gemini 는 `additionalProperties` 나 `type: [..., "null"]` 을 못 받아서 옮겨 적어요.
 */
export function toGeminiSchema(node: unknown): Record<string, unknown> {
  const src = asRecord(node);
  if (!src) return { type: "STRING" };

  const out: Record<string, unknown> = {};

  // type: "string" 또는 ["string", "null"]
  const rawType = src.type;
  if (Array.isArray(rawType)) {
    const main = rawType.find((t) => t !== "null");
    if (typeof main === "string") out.type = TYPE_MAP[main] ?? "STRING";
    if (rawType.includes("null")) out.nullable = true;
  } else if (typeof rawType === "string") {
    out.type = TYPE_MAP[rawType] ?? "STRING";
  }

  if (typeof src.description === "string") out.description = src.description;
  if (Array.isArray(src.enum)) {
    out.enum = src.enum.map(String);
    out.type = "STRING";
  }
  if (src.items) out.items = toGeminiSchema(src.items);

  const props = asRecord(src.properties);
  if (props) {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) mapped[key] = toGeminiSchema(value);
    out.properties = mapped;
    out.type = "OBJECT";
    if (Array.isArray(src.required)) out.required = src.required.map(String);
    // 답변 순서를 고정하면 출력이 더 안정적이에요
    out.propertyOrdering = Object.keys(mapped);
  }

  if (!out.type) out.type = "STRING";
  return out;
}

// ── 구조화 JSON ─────────────────────────────────────────────────────────────

export async function geminiGenerateJson<T>(req: {
  model: string;
  system: string;
  user: string;
  images?: AiImage[];
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<{ data: T; model: string }> {
  const jsonSchema = z.toJSONSchema(req.schema as z.ZodType<unknown>, { target: "draft-7", io: "output" });

  const parts: GeminiPart[] = [];
  for (const image of req.images ?? []) {
    parts.push({ inlineData: { mimeType: image.mediaType, data: image.base64 } });
  }
  parts.push({ text: req.user });

  const res = await callGemini(req.model, "generateContent", {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(jsonSchema),
      maxOutputTokens: req.maxTokens ?? 4096,
    },
  });

  const body = asRecord(await res.json());
  const candidate = asRecord((body?.candidates as unknown[] | undefined)?.[0]);
  const text = ((asRecord(candidate?.content)?.parts as unknown[] | undefined) ?? [])
    .map((p) => asRecord(p)?.text)
    .filter((t): t is string => typeof t === "string")
    .join("");

  if (!text.trim()) {
    const reason = candidate?.finishReason;
    throw new AiError(`빈 응답을 받았어요${reason ? ` (${String(reason)})` : ""}.`, "other");
  }

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
  return { data: parsed.data, model: req.model };
}

// ── 도구를 쓰는 스트리밍 ─────────────────────────────────────────────────────

function toGeminiContents(turns: AiTurn[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const turn of turns) {
    if (turn.role === "user") {
      out.push({ role: "user", parts: [{ text: turn.text }] });
    } else if (turn.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (turn.text) parts.push({ text: turn.text });
      for (const call of turn.toolCalls) {
        parts.push({ functionCall: { name: call.name, args: (call.input as object) ?? {} } });
      }
      if (parts.length) out.push({ role: "model", parts });
    } else {
      // Gemini 는 도구 결과도 user 차례로 받아요
      out.push({
        role: "user",
        parts: turn.results.map((r) => ({
          functionResponse: { name: r.name, response: { result: r.content } },
        })),
      });
    }
  }
  return out;
}

export async function geminiStreamTurn(req: {
  model: string;
  system: string;
  turns: AiTurn[];
  tools: AiToolDef[];
  maxTokens?: number;
  onText: (delta: string) => void;
}): Promise<StreamResult> {
  const res = await callGemini(
    req.model,
    "streamGenerateContent",
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: toGeminiContents(req.turns),
      ...(req.tools.length > 0 && {
        tools: [
          {
            functionDeclarations: req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: toGeminiSchema(t.inputSchema),
            })),
          },
        ],
      }),
      generationConfig: { maxOutputTokens: req.maxTokens ?? 2048 },
    },
    { sse: true },
  );

  let text = "";
  const toolCalls: StreamResult["toolCalls"] = [];

  const reader = res.body?.getReader();
  if (!reader) throw new AiError("스트림을 열지 못했어요.", "other");
  const decoder = new TextDecoder();
  let buffer = "";

  const handleChunk = (payload: string) => {
    if (!payload || payload === "[DONE]") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const candidate = asRecord((asRecord(parsed)?.candidates as unknown[] | undefined)?.[0]);
    const parts = (asRecord(candidate?.content)?.parts as unknown[] | undefined) ?? [];
    for (const part of parts) {
      const p = asRecord(part);
      if (typeof p?.text === "string" && p.text) {
        text += p.text;
        req.onText(p.text);
      }
      const call = asRecord(p?.functionCall);
      if (call && typeof call.name === "string") {
        toolCalls.push({
          id: `${call.name}-${toolCalls.length}`,
          name: call.name,
          input: call.args ?? {},
        });
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE: 빈 줄로 구분된 "data: {...}" 묶음
    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      for (const line of block.split("\n")) {
        if (line.startsWith("data:")) handleChunk(line.slice(5).trim());
      }
      split = buffer.indexOf("\n\n");
    }
  }
  for (const line of buffer.split("\n")) {
    if (line.startsWith("data:")) handleChunk(line.slice(5).trim());
  }

  return { text, toolCalls, model: req.model };
}
