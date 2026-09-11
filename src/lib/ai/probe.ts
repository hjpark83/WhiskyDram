import { geminiBase, geminiKey, quotaHintFromBody } from "@/lib/ai/gemini";
import { activeProvider } from "@/lib/ai/provider";

/**
 * "한도에 걸린 건가, 기능이 아예 안 되는 건가"
 *
 * ## 왜 이게 따로 필요한가
 *
 * 팝업 웹 검색이 한 번도 성공한 적이 없다는 얘기를 듣고 만들었어요. 화면에는
 * 계속 429(한도) 만 뜨는데, 그것만으로는 **두 가지를 구분할 수 없어요.**
 *
 *  1. 계정의 하루 한도를 다 썼다 → 기다리거나 결제를 붙이면 돼요
 *  2. 검색 그라운딩 자체가 이 키·티어에서 안 된다 → 기다려도 영원히 안 돼요
 *
 * 자기점검(`self-check.ts`)은 **기능**을 부르기 때문에 이걸 못 가려요. 기능이
 * 실패하면 폴백으로 넘어가서 "폴백이에요" 로 보일 뿐이고, 실패 이유가 한도인지
 * 기능 미지원인지는 여전히 안 보여요.
 *
 * ## 어떻게 가리나
 *
 * **같은 키로 최소 호출을 두 번** 날려요 — 웹 검색 없이 한 번, 웹 검색을 붙여
 * 한 번. 그리고 원시 HTTP 상태를 나란히 보여줘요.
 *
 *  - 둘 다 실패 → 계정 전체 한도. 웹 검색 기능 문제가 아니에요.
 *  - 일반은 되고 검색만 실패 → **한도가 아니라 그라운딩 쪽 문제**예요.
 *  - 둘 다 성공 → 기능은 정상. 지금 이 순간은 돼요.
 *
 * 프롬프트를 최소로 해서 진단 자체가 한도를 많이 먹지 않게 했어요.
 */

export interface ProbeRow {
  name: string;
  /** 원시 HTTP 상태. 네트워크 자체가 실패하면 null */
  status: number | null;
  ok: boolean;
  ms: number;
  /** 응답 앞부분 (성공이면 받은 글자, 실패면 오류 본문) */
  body: string;
}

export interface ProbeReport {
  provider: string;
  model: string;
  rows: ProbeRow[];
  /** 두 줄을 비교해서 내린 결론 */
  verdict: string;
  /** 무엇을 해야 하는지 */
  advice: string;
}

/** 진단이 한도를 덜 먹게 최소한만 물어봐요 */
const TINY_PROMPT = "한 단어로 답해주세요: 물은 무슨 색인가요?";

async function callOnce(name: string, useSearch: boolean): Promise<ProbeRow> {
  const key = geminiKey();
  const provider = activeProvider();
  const started = Date.now();
  if (!key || !provider) {
    return { name, status: null, ok: false, ms: 0, body: "GEMINI_API_KEY 가 없어요." };
  }

  try {
    const res = await fetch(
      `${geminiBase()}/models/${encodeURIComponent(provider.model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: TINY_PROMPT }] }],
          ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: { maxOutputTokens: 32 },
        }),
      },
    );
    const raw = await res.text();
    const ms = Date.now() - started;

    if (!res.ok) {
      // 429 면 분당/하루 판단까지 붙여줘요 (gemini.ts 와 같은 안내)
      const hint = res.status === 429 ? quotaHintFromBody(raw) : "";
      return { name, status: res.status, ok: false, ms, body: `${hint} ${raw}`.trim().slice(0, 400) };
    }

    // 성공이면 실제로 글자가 왔는지까지 봐요 (200 인데 빈 응답인 경우가 있어요)
    const text = extractText(raw);
    return {
      name,
      status: res.status,
      ok: text.length > 0,
      ms,
      body: text.length > 0 ? `받은 글자: "${text.slice(0, 80)}"` : `200 인데 글자가 비었어요: ${raw.slice(0, 200)}`,
    };
  } catch (error) {
    return {
      name,
      status: null,
      ok: false,
      ms: Date.now() - started,
      body: `요청 자체가 실패했어요: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function extractText(raw: string): string {
  try {
    const body = JSON.parse(raw) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (body.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
  } catch {
    return "";
  }
}

export async function probeGemini(): Promise<ProbeReport> {
  const provider = activeProvider();
  if (!provider || provider.id !== "gemini") {
    return {
      provider: provider?.label ?? "없음",
      model: provider?.model ?? "-",
      rows: [],
      verdict: "이 진단은 Gemini 전용이에요.",
      advice:
        "지금 쓰는 프로바이더가 Gemini 가 아니에요. 기능별 동작은 아래 자기점검으로 확인해주세요.",
    };
  }

  // 순서대로 불러요 (동시에 부르면 분당 한도를 스스로 건드려서 결과가 헷갈려요)
  const plain = await callOnce("일반 호출 (웹 검색 없음)", false);
  const search = await callOnce("웹 검색 붙인 호출 (google_search)", true);

  const { verdict, advice } = judge(plain, search);
  return { provider: provider.label, model: provider.model, rows: [plain, search], verdict, advice };
}

function judge(plain: ProbeRow, search: ProbeRow): { verdict: string; advice: string } {
  if (plain.ok && search.ok) {
    return {
      verdict: "둘 다 성공했어요 — 웹 검색 기능은 정상이에요.",
      advice:
        "지금 이 순간은 됩니다. 팝업 찾기를 바로 눌러보세요. 그래도 실패하면 한도가 아니라 다른 문제이니 알려주세요.",
    };
  }
  if (plain.ok && !search.ok) {
    // 가장 알고 싶었던 경우 — 한도가 아니라 그라운딩만 막힌 것
    const tier =
      search.status === 429
        ? "웹 검색에는 별도 한도가 걸려 있어요 (일반 호출과 따로 세요). 무료 등급에서 이게 0 인 경우도 있어서, 기다려도 안 풀릴 수 있어요."
        : search.status === 400
          ? "이 모델이 google_search 도구를 못 받는다는 뜻이에요. GEMINI_MODEL 을 바꿔보세요."
          : search.status === 403
            ? "키에 이 기능 권한이 없어요. 결제 연결 여부와 프로젝트 설정을 확인해주세요."
            : "원인이 상태 코드에 있어요 — 아래 본문을 봐주세요.";
    return {
      verdict: `일반 호출은 되는데 **웹 검색만 실패**했어요 (${search.status ?? "네트워크 실패"}). 계정 전체 한도 문제가 아니에요.`,
      advice: `${tier} 팝업은 관리자 화면에서 직접 등록하는 길이 있으니, 발표에는 그걸 쓰시는 게 안전해요.`,
    };
  }
  if (!plain.ok && !search.ok) {
    return {
      verdict: "둘 다 실패했어요 — 웹 검색 기능 문제가 아니라 **계정 전체가 막힌 상태**예요.",
      advice:
        "일반 호출조차 안 되니 한도(또는 키) 문제예요. 아래 본문의 안내를 따라주세요. 한도가 풀리면 웹 검색도 같이 될 가능성이 높아요.",
    };
  }
  return {
    verdict: "웹 검색은 됐는데 일반 호출이 실패했어요 — 흔하지 않은 조합이에요.",
    advice: "아래 두 본문을 그대로 알려주세요. 코드에서 봐야 할 것 같아요.",
  };
}
