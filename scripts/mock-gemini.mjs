/**
 * 개발용 가짜 Gemini 서버.
 *
 * 진짜 키 없이 AI 경로(요청 모양 · 스키마 변환 · SSE 파싱 · 툴 루프)를
 * 끝까지 통과시켜 보려고 만든 거예요. 실행한 뒤 GEMINI_BASE_URL 을 여기로 돌리면
 * 앱 코드는 진짜 Gemini 를 부르는 줄 알고 동작해요.
 *
 *   node scripts/mock-gemini.mjs 8787
 *   GEMINI_BASE_URL=http://127.0.0.1:8787 GEMINI_API_KEY=test npm run dev
 *
 * 중요한 점: 진짜 Gemini 처럼 **스키마를 깐깐하게 검사**해요.
 * additionalProperties 나 `type: ["string","null"]` 처럼 Gemini 가 못 받는 게 오면
 * 400 으로 거절해서, 우리 변환기(toGeminiSchema)의 버그를 잡아줘요.
 */

import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 8787);

/** Gemini(OpenAPI 3.0 부분집합)가 받아주는 키만 통과 */
const ALLOWED_SCHEMA_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "propertyOrdering",
  "minItems",
  "maxItems",
]);
const ALLOWED_TYPES = new Set(["STRING", "NUMBER", "INTEGER", "BOOLEAN", "ARRAY", "OBJECT"]);

function validateSchema(node, path = "$") {
  if (node === null || typeof node !== "object") {
    throw new Error(`${path}: 스키마 노드가 객체가 아니에요`);
  }
  for (const key of Object.keys(node)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) {
      throw new Error(`${path}: Gemini 가 모르는 키 "${key}" 가 들어 있어요`);
    }
  }
  if (typeof node.type !== "string" || !ALLOWED_TYPES.has(node.type)) {
    throw new Error(`${path}: type 은 대문자 ${[...ALLOWED_TYPES].join("/")} 중 하나여야 해요 (받은 값: ${JSON.stringify(node.type)})`);
  }
  if (node.type === "OBJECT") {
    if (!node.properties || typeof node.properties !== "object") {
      throw new Error(`${path}: OBJECT 에는 properties 가 있어야 해요`);
    }
    for (const [key, value] of Object.entries(node.properties)) {
      validateSchema(value, `${path}.${key}`);
    }
  }
  if (node.type === "ARRAY") {
    if (!node.items) throw new Error(`${path}: ARRAY 에는 items 가 있어야 해요`);
    validateSchema(node.items, `${path}[]`);
  }
}

/** 스키마에 맞는 그럴듯한 값을 만들어요 (앱의 zod 검증을 통과해야 해요) */
function sample(node, key = "") {
  if (Array.isArray(node.enum) && node.enum.length > 0) return node.enum[0];
  switch (node.type) {
    case "STRING": {
      // 날짜처럼 형식이 정해진 필드는 형식을 맞춰줘요
      if (/date$/i.test(key)) return "2026-09-10";
      if (/url|link|source/i.test(key)) return "https://example.com/mock";
      return `모의 ${key || "값"}`;
    }
    case "INTEGER":
    case "NUMBER":
      return 0;
    case "BOOLEAN":
      return true;
    case "ARRAY": {
      // 길이 제약이 있으면 맞춰줘요 (예: picks 는 정확히 3개)
      const n = node.minItems ?? (node.maxItems && node.maxItems < 2 ? node.maxItems : 1);
      return Array.from({ length: Math.max(1, n) }, () => sample(node.items, key));
    }
    case "OBJECT": {
      const out = {};
      for (const [k, v] of Object.entries(node.properties ?? {})) out[k] = sample(v, k);
      return out;
    }
    default:
      return null;
  }
}

/**
 * 배열 안 객체에 서로 달라야 하는 id 가 있으면(enum) 앞에서부터 다른 값을 골라줘요.
 * 앱이 "서로 다른 3병" 같은 걸 기대하기 때문이에요.
 */
function diversify(value, node) {
  if (node?.type === "ARRAY" && Array.isArray(value) && node.items?.type === "OBJECT") {
    const idKey = Object.keys(node.items.properties ?? {}).find((k) => /id$/i.test(k));
    const options = idKey ? node.items.properties[idKey]?.enum : null;
    if (idKey && Array.isArray(options)) {
      value.forEach((item, i) => {
        item[idKey] = options[Math.min(i, options.length - 1)];
      });
    }
  }
  if (node?.type === "OBJECT") {
    for (const [k, v] of Object.entries(node.properties ?? {})) diversify(value?.[k], v);
  }
  return value;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function fail(res, status, message) {
  console.log(`  ✗ ${status} ${message}`);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: { code: status, message, status: "INVALID_ARGUMENT" } }));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/\/models\/([^:]+):(generateContent|streamGenerateContent)$/);

  if (!match) return fail(res, 404, `모르는 경로: ${url.pathname}`);
  if (!req.headers["x-goog-api-key"]) return fail(res, 401, "x-goog-api-key 헤더가 없어요");

  const [, model, method] = match;
  const body = await readBody(req).catch(() => null);
  if (!body) return fail(res, 400, "본문이 JSON 이 아니에요");

  console.log(`\n▶ ${method} model=${model}`);

  // 공통 검사: contents 모양
  if (!Array.isArray(body.contents) || body.contents.length === 0) {
    return fail(res, 400, "contents 가 비었어요");
  }
  for (const [i, c] of body.contents.entries()) {
    if (c.role !== "user" && c.role !== "model") {
      return fail(res, 400, `contents[${i}].role 은 user|model 이어야 해요 (받은 값: ${c.role})`);
    }
    if (!Array.isArray(c.parts) || c.parts.length === 0) {
      return fail(res, 400, `contents[${i}].parts 가 비었어요`);
    }
  }
  console.log(`  contents=${body.contents.length}턴 (${body.contents.map((c) => c.role).join(" → ")})`);
  if (body.systemInstruction) console.log("  systemInstruction 있음");

  // 1) 검색 그라운딩
  if (Array.isArray(body.tools) && body.tools.some((t) => t.google_search)) {
    console.log("  google_search 그라운딩 요청");
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: [
                    "발베니 크래프트 바 팝업",
                    "- 기간: 2026-09-10 ~ 2026-10-05",
                    "- 장소: 서울 성동구 성수동",
                    "- 예약: 캐치테이블",
                    "- 출처: https://example.com/mock-article",
                  ].join("\n"),
                },
              ],
            },
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://example.com/mock-article", title: "모의 기사" } },
              ],
            },
          },
        ],
      }),
    );
  }

  // 2) 구조화 JSON
  if (method === "generateContent") {
    const schema = body.generationConfig?.responseSchema;
    if (body.generationConfig?.responseMimeType !== "application/json") {
      return fail(res, 400, "responseMimeType 이 application/json 이 아니에요");
    }
    if (!schema) return fail(res, 400, "responseSchema 가 없어요");
    try {
      validateSchema(schema);
    } catch (error) {
      return fail(res, 400, `responseSchema 문제 — ${error.message}`);
    }
    const hasImage = body.contents.some((c) => c.parts.some((p) => p.inlineData));
    console.log(`  스키마 OK (최상위 필드 ${Object.keys(schema.properties ?? {}).length}개)${hasImage ? " · 이미지 포함" : ""}`);

    const payload = diversify(sample(schema), schema);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: "STOP" }],
      }),
    );
  }

  // 3) 툴을 쓰는 스트리밍
  const decls = body.tools?.[0]?.functionDeclarations ?? [];
  for (const [i, d] of decls.entries()) {
    if (!d.name) return fail(res, 400, `functionDeclarations[${i}].name 이 없어요`);
    try {
      validateSchema(d.parameters, `tools[${i}].parameters`);
    } catch (error) {
      return fail(res, 400, `도구 스키마 문제 — ${error.message}`);
    }
  }
  const alreadyCalled = body.contents.some((c) => c.parts.some((p) => p.functionResponse));
  console.log(`  도구 ${decls.length}개 · ${alreadyCalled ? "도구 결과 받음 → 마무리 응답" : "첫 턴 → 도구 호출"}`);

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const part = (p) => ({ candidates: [{ content: { parts: [p] } }] });

  if (!alreadyCalled && decls.length > 0) {
    send(part({ text: "잠깐 찾아볼게요. " }));
    send(part({ functionCall: { name: decls[0].name, args: { query: "삼겹살", limit: 3 } } }));
  } else {
    // 한 글자씩 흘려보내 SSE 조립을 확인해요
    for (const chunk of ["찾았어요! ", "삼겹살에는 ", "연기 향이 ", "은은한 병이 잘 맞아요."]) {
      send(part({ text: chunk }));
    }
  }
  send({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] });
  res.end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`가짜 Gemini 서버: http://127.0.0.1:${PORT}`);
});
