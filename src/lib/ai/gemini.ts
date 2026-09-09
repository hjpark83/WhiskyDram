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

/**
 * 기본은 구글 엔드포인트. `GEMINI_BASE_URL` 로 바꿀 수 있어요
 * (사내 프록시를 태우거나, 개발할 때 가짜 서버로 검증할 때 씁니다).
 */
export function geminiBase(): string {
  return (process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
}

export function geminiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return key || undefined;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: unknown };
  functionResponse?: { name: string; response: Record<string, unknown> };
  /**
   * Gemini 3.x 가 functionCall 파트에 붙여주는 불투명 토큰.
   * 대화를 이어갈 때 **같은 파트에 그대로 다시 실어 보내야** 해요.
   * 빠지면 `Function call is missing a thought_signature` 400 이 나요.
   */
  thoughtSignature?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/** 429 응답의 RetryInfo("3s") 를 밀리초로. 없으면 null. */
function retryDelayMs(raw: string): number | null {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(raw);
  return match ? Math.ceil(Number(match[1]) * 1000) : null;
}

/**
 * 429 가 **분당** 한도인지 **하루** 한도인지.
 *
 * 둘은 대응이 완전히 달라요 — 분당이면 30초 뒤에 되고, 하루면 내일까지 안 돼요.
 * 그런데 둘 다 그냥 "요청이 많아요" 로만 말하면, 기다리면 될 일인지 결제를 붙여야
 * 할 일인지 알 수가 없어요. 구글이 `quotaId` 에 적어주는 걸 그대로 읽어요
 * (예: `GenerateRequestsPerMinutePerProjectPerModel-FreeTier`).
 */
export type QuotaScope = "minute" | "day" | null;

function quotaScope(raw: string): QuotaScope {
  const id = /"quotaId"\s*:\s*"([^"]+)"/.exec(raw)?.[1] ?? "";
  if (/PerDay/i.test(id)) return "day";
  if (/PerMinute/i.test(id)) return "minute";
  return null;
}

/**
 * 429 응답 **본문 하나로** 안내 문구까지.
 *
 * 검색 그라운딩(`web-research.ts`)은 자기 fetch 를 따로 써서 아래 `callGemini`
 * 를 안 거쳐요. 그래서 한도 안내를 여기 모아두고 양쪽이 같이 써요 — 안 그러면
 * 자기점검에서 **다섯 줄은 "하루 한도" 라고 하는데 팝업 한 줄만 "잠시 뒤 다시"**
 * 라고 하는 일이 생겨요 (실제로 그랬어요).
 */
export function quotaHintFromBody(raw: string): string {
  return quotaHint(quotaScope(raw), retryDelayMs(raw));
}

/** 429 안내 문구 — 기다리면 될 일인지, 결제를 붙여야 할 일인지 딱 말해줘요 */
export function quotaHint(scope: QuotaScope, retryAfterMs: number | null): string {
  if (scope === "day") {
    return " (오늘 쓸 수 있는 무료 한도를 다 썼어요 — 한국 시간 오후 4~5시쯤 초기화돼요. 지금 꼭 써야 하면 Google AI Studio 에서 결제를 연결하거나, 다른 프로바이더 키를 넣어주세요)";
  }
  const sec = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : null;
  return ` (분당 한도예요 — ${sec ? `${sec}초` : "30초"}쯤 뒤에 다시 눌러주세요)`;
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

  const url = `${geminiBase()}/models/${encodeURIComponent(model)}:${method}${sse ? "?alt=sse" : ""}`;
  const payload = JSON.stringify(body);
  const send = () =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: payload,
    });

  let res = await send();

  // 무료 등급은 분당 요청 수가 빡빡해서, 화면을 두 번 누르기만 해도 429 가 나요.
  // 구글이 알려주는 대기 시간만큼(최대 8초) 한 번만 다시 시도해요.
  //
  // **하루 한도면 다시 시도하지 않아요.** 어차피 또 429 인데 8초를 그냥 버리는 거라,
  // 사용자는 "왜 이렇게 오래 걸리다 실패하지" 만 겪게 되거든요.
  let scope: QuotaScope = null;
  let retryAfter: number | null = null;
  if (res.status === 429) {
    const body429 = await res.clone().text().catch(() => "");
    scope = quotaScope(body429);
    retryAfter = retryDelayMs(body429);
    if (scope !== "day") {
      await new Promise((r) => setTimeout(r, Math.min(8000, retryAfter ?? 3000)));
      res = await send();
      if (res.status === 429) {
        const again = await res.clone().text().catch(() => "");
        scope = quotaScope(again) ?? scope;
        retryAfter = retryDelayMs(again) ?? retryAfter;
      }
    }
  }

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
          : res.status === 429
            ? quotaHint(scope, retryAfter)
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

  // zod 는 nullable 객체·배열을 anyOf: [ {…}, {type:"null"} ] 로 내보내요.
  // Gemini 에는 union 이 없으니 null 이 아닌 가지를 쓰고 nullable 로 표시해요.
  const union = (src.anyOf ?? src.oneOf) as unknown[] | undefined;
  if (Array.isArray(union) && union.length > 0) {
    const branches = union.map(asRecord);
    const nullable = branches.some((b) => b?.type === "null");
    const main = branches.find((b) => b && b.type !== "null");
    const converted = toGeminiSchema(main ?? {});
    if (nullable) converted.nullable = true;
    if (typeof src.description === "string") converted.description = src.description;
    return converted;
  }

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
  if (src.items) {
    out.items = toGeminiSchema(src.items);
    // 개수 제약은 Gemini 도 받아요. 빼먹으면 "정확히 3개" 같은 약속이 지켜지지 않아
    // 응답이 zod 검증에서 떨어지고 폴백으로 새요.
    if (typeof src.minItems === "number") out.minItems = src.minItems;
    if (typeof src.maxItems === "number") out.maxItems = src.maxItems;
  }

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
    const reason = String(candidate?.finishReason ?? "");
    const usage = asRecord(body?.usageMetadata);
    const thoughts = Number(usage?.thoughtsTokenCount ?? 0);
    // 생각하는 모델은 생각에도 출력 예산을 쓰기 때문에, 예산이 모자라면
    // 글자가 하나도 안 온 채로 MAX_TOKENS 로 끝나요. 원인을 바로 알려줘요.
    const hint =
      reason === "MAX_TOKENS"
        ? ` — 출력 예산(maxOutputTokens)을 생각(thinking)에 다 썼어요${
            thoughts ? ` (생각 ${thoughts}토큰)` : ""
          }. maxTokens 를 늘려주세요.`
        : reason === "SAFETY" || reason === "PROHIBITED_CONTENT"
          ? " — 안전 필터에 걸렸어요."
          : "";
    throw new AiError(`빈 응답을 받았어요${reason ? ` (${reason})` : ""}.${hint}`, "other");
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
        parts.push({
          functionCall: { name: call.name, args: (call.input as object) ?? {} },
          // 받은 서명을 그대로 되돌려줘요 (Gemini 3.x 필수)
          ...(call.signature ? { thoughtSignature: call.signature } : {}),
        });
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
          // 같은 파트에 실려온 서명을 챙겨둬요 — 다음 요청에 되돌려줘야 해요
          ...(typeof p?.thoughtSignature === "string" ? { signature: p.thoughtSignature } : {}),
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
