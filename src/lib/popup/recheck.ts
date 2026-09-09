import type { PopupCheck, PopupSnapshot } from "@/lib/ai/popup-research";
import type { PopupRecord } from "@/lib/popup/store";

/**
 * 재확인 결과를 **변경 제안**으로 바꿔요.
 *
 * ## 왜 바로 덮어쓰지 않나
 *
 * 팝업 정보는 관리자가 확인한 뒤에 공개하는 게 원칙이에요. 재확인이 값을 말없이
 * 바꾸면 그 원칙이 무의미해져요 — 한 번 확인받은 화면이 다음 날 아무도 안 본
 * 값으로 바뀌어 있을 수 있으니까요. 그래서 제안만 만들고 적용은 사람이 해요.
 *
 * ## 빈 값은 "바뀜" 이 아니에요
 *
 * 이게 이 파일에서 가장 중요한 규칙이에요. AI 가 운영 시간을 못 찾으면 빈
 * 문자열을 돌려줘요. 그걸 "운영 시간이 없어졌다" 로 읽으면, **검색이 한 번
 * 부실했을 뿐인데 잘 적어둔 정보가 지워져요.** 그래서 새 값이 비어 있으면
 * 아무 제안도 만들지 않아요 (기존 값 유지).
 *
 * 정보를 정말 지워야 하는 경우(행사가 취소돼서 입장료가 무의미해진 등)는
 * 관리자가 직접 수정 화면에서 지우면 돼요. 자동화가 지울 일은 아니에요.
 */

/** 재확인에서 다시 물어보는 칸만 (설명·요약은 표현이 흔들려서 제외) */
const FIELDS = [
  { key: "startDate", label: "시작일" },
  { key: "endDate", label: "종료일" },
  { key: "hours", label: "운영 시간" },
  { key: "entry", label: "입장 · 예약료" },
  { key: "venue", label: "장소" },
  { key: "address", label: "주소" },
  { key: "reservation", label: "예약 방법" },
] as const;

export type RecheckField = (typeof FIELDS)[number]["key"];

export interface RecheckChange {
  field: RecheckField;
  /** 화면에 보여줄 칸 이름 */
  label: string;
  from: string;
  to: string;
}

export interface PendingRecheck {
  /** 재확인을 돌린 시각 (ISO) */
  checkedAt: string;
  changes: RecheckChange[];
  sources: string[];
  note: string;
  confidence: PopupCheck["confidence"];
  /** 웹에서 이미 끝난 행사로 보였는지 */
  ended: boolean;
  /** 웹에서 행사를 아예 못 찾았는지 */
  notFound: boolean;
  provider: string;
  model: string;
}

/** 재확인에 넘길 지금 값만 뽑아요 */
export function snapshot(p: PopupRecord): PopupSnapshot {
  return {
    brand: p.brand,
    title: p.title,
    venue: p.venue,
    city: p.city,
    address: p.address,
    startDate: p.startDate,
    endDate: p.endDate,
    hours: p.hours,
    entry: p.entry,
    reservation: p.reservation,
    sources: p.sources,
  };
}

/** 공백만 다른 건 바뀐 게 아니에요 */
function same(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ") === b.trim().replace(/\s+/g, " ");
}

/**
 * 지금 값과 재확인 결과를 비교해 제안을 만들어요.
 * 바뀐 게 없으면 `changes` 가 빈 배열이고, 그래도 "언제 확인했다" 는 남겨요
 * (확인했는데 그대로인 것과, 아직 확인 안 한 것은 다르니까요).
 */
export function diffRecheck(popup: PopupRecord, check: PopupCheck): PendingRecheck {
  const changes: RecheckChange[] = [];

  // 못 찾았으면 값 비교를 아예 하지 않아요. 검색이 실패한 것과 정보가 바뀐 것은
  // 완전히 다른 일인데, 이걸 섞으면 "장소가 사라졌어요" 같은 헛제안이 나와요.
  if (check.found) {
    for (const { key, label } of FIELDS) {
      const to = String(check[key] ?? "").trim();
      // 빈 값 = "확인 못 함" (위 주석 참고). 기존 값을 지우지 않아요.
      if (!to) continue;
      const from = String(popup[key] ?? "").trim();
      if (same(from, to)) continue;
      changes.push({ field: key, label, from, to });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    changes,
    sources: check.sources,
    note: check.note.trim(),
    confidence: check.confidence,
    ended: check.found && check.ended,
    notFound: !check.found,
    provider: check.provider,
    model: check.model,
  };
}

/** DB 의 jsonb 를 안전하게 읽어요 (사람이 손댔거나 옛 형식일 수 있어요) */
export function parsePendingRecheck(value: unknown): PendingRecheck | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.checkedAt !== "string") return null;

  const keys = FIELDS.map((f) => f.key) as string[];
  const changes: RecheckChange[] = Array.isArray(v.changes)
    ? v.changes.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const c = raw as Record<string, unknown>;
        if (typeof c.field !== "string" || !keys.includes(c.field)) return [];
        if (typeof c.to !== "string" || !c.to) return [];
        const label = FIELDS.find((f) => f.key === c.field)!.label;
        return [
          {
            field: c.field as RecheckField,
            label: typeof c.label === "string" && c.label ? c.label : label,
            from: typeof c.from === "string" ? c.from : "",
            to: c.to,
          },
        ];
      })
    : [];

  const confidence = ["high", "medium", "low"].includes(String(v.confidence))
    ? (v.confidence as PendingRecheck["confidence"])
    : "low";

  return {
    checkedAt: v.checkedAt,
    changes,
    sources: Array.isArray(v.sources)
      ? v.sources.filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
      : [],
    note: typeof v.note === "string" ? v.note : "",
    confidence,
    ended: v.ended === true,
    notFound: v.notFound === true,
    provider: typeof v.provider === "string" ? v.provider : "",
    model: typeof v.model === "string" ? v.model : "",
  };
}

/**
 * 제안을 적용할 때 DB 에 쓸 값.
 *
 * `reservation` 은 DB 에 check 제약이 걸려 있어서(catchtable/naver/instagram/walkin)
 * 엉뚱한 값이 오면 통째로 저장이 실패해요. 여기서 걸러요.
 */
const RESERVATIONS = ["catchtable", "naver", "instagram", "walkin"];

export function applyChanges(changes: RecheckChange[]): Record<string, string> {
  const COLUMN: Record<RecheckField, string> = {
    startDate: "start_date",
    endDate: "end_date",
    hours: "hours",
    entry: "entry",
    venue: "venue",
    address: "address",
    reservation: "reservation",
  };
  const out: Record<string, string> = {};
  for (const c of changes) {
    if (c.field === "reservation" && !RESERVATIONS.includes(c.to)) continue;
    out[COLUMN[c.field]] = c.to;
  }
  return out;
}

/**
 * 재확인이 필요한 팝업을 고를 때 쓰는 기준.
 *
 * - **끝난 행사는 안 봐요.** 이미 지난 정보라 고쳐도 아무도 안 봐요.
 * - **오래 확인 안 한 것부터.** 한 번도 확인 안 한 것(null)이 가장 먼저예요.
 * - **아직 안 본 제안이 있으면 건너뛰어요.** 관리자가 보기 전에 새 제안으로
 *   덮으면, 확인하려던 내용이 사라져요.
 */
export function needsRecheck(
  p: Pick<PopupRecord, "endDate" | "lastCheckedAt" | "pendingRecheck">,
  opts: { staleDays?: number; now?: Date } = {},
): boolean {
  const now = opts.now ?? new Date();
  const staleDays = opts.staleDays ?? 3;

  // 끝난 행사는 재확인 대상이 아니에요
  const [y, m, d] = p.endDate.split("-").map(Number);
  const end = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (today > end) return false;

  if (p.pendingRecheck) return false;
  if (!p.lastCheckedAt) return true;

  const last = new Date(p.lastCheckedAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= staleDays * 86_400_000;
}
