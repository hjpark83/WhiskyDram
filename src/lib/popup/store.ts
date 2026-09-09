import { SEED_POPUPS, type PopupLink, type PopupReservation, type PopupStore } from "@/data/popups";
import { parsePendingRecheck, type PendingRecheck } from "@/lib/popup/recheck";
import { rethrowIfFrameworkError } from "@/lib/next-error";
import { createClient } from "@/lib/supabase/server";

/**
 * 팝업 정보를 읽어요.
 *
 * Supabase `popup_stores` 에 등록된 게 있으면 그걸 쓰고, 테이블이 아직 없거나 비어 있으면
 * 예시 시드(SEED_POPUPS)를 보여줘요. 그래서 스키마를 안 돌려도 화면은 항상 채워져요.
 */

export interface PopupRecord extends PopupStore {
  published: boolean;
  source: "db" | "seed";
  /** AI 가 웹 검색으로 만든 초안인지 (관리자 확인 전) */
  aiGenerated: boolean;
  /** 근거가 된 주소 */
  sources: string[];
  /** 관리자가 확인해야 할 것 */
  aiNote: string | null;
  /**
   * 이 정보를 마지막으로 손본 시각 (ISO).
   *
   * 정리해서 우리 화면에 두는 방식은 링크만 걸어두는 것보다 훨씬 편한데,
   * **오래되면 링크보다 나빠져요** — 우리 이름으로 틀린 기간을 보여주는 거니까요.
   * 그래서 언제 확인한 정보인지 화면에 같이 적어요. 예시 시드는 확인 날짜가
   * 없어서 null 이에요.
   */
  updatedAt: string | null;
  /**
   * 마지막으로 **웹에서 다시 확인한** 시각 (ISO).
   *
   * `updatedAt` 과 다른 값이에요. updatedAt 은 관리자가 색만 바꿔도 갱신되니까
   * "이 정보 언제 확인했어요?" 의 답으로 쓸 수 없어요.
   */
  lastCheckedAt: string | null;
  /** 아직 적용하지 않은 변경 제안 (재확인이 찾아낸 것) */
  pendingRecheck: PendingRecheck | null;
}

interface PopupRow {
  id: string;
  brand: string;
  brand_en: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  highlights: string[] | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  start_date: string;
  end_date: string;
  hours: string | null;
  entry: string | null;
  reservation: string | null;
  links: unknown;
  whisky_ids: string[] | null;
  tags: string[] | null;
  accent: string | null;
  image_url: string | null;
  published: boolean | null;
  ai_generated: boolean | null;
  sources: unknown;
  ai_note: string | null;
  updated_at: string | null;
  last_checked_at: string | null;
  pending_recheck: unknown;
}

const RESERVATIONS: PopupReservation[] = ["catchtable", "naver", "instagram", "walkin"];
const LINK_KINDS: PopupLink["kind"][] = ["catchtable", "naver", "instagram", "official", "map"];

function parseLinks(value: unknown): PopupLink[] {
  if (!Array.isArray(value)) return [];
  const out: PopupLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { kind, label, url } = item as Record<string, unknown>;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
    const k = LINK_KINDS.includes(kind as PopupLink["kind"]) ? (kind as PopupLink["kind"]) : "official";
    out.push({ kind: k, label: typeof label === "string" && label ? label : k, url });
  }
  return out;
}

function toRecord(row: PopupRow): PopupRecord {
  const reservation = RESERVATIONS.includes(row.reservation as PopupReservation)
    ? (row.reservation as PopupReservation)
    : "walkin";
  return {
    id: row.id,
    brand: row.brand,
    brandEn: row.brand_en ?? "",
    title: row.title,
    summary: row.summary ?? "",
    description: row.description ?? "",
    highlights: row.highlights ?? [],
    venue: row.venue ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    startDate: row.start_date,
    endDate: row.end_date,
    hours: row.hours ?? "",
    entry: row.entry ?? "",
    reservation,
    links: parseLinks(row.links),
    whiskyIds: row.whisky_ids ?? [],
    tags: row.tags ?? [],
    accent: row.accent ?? "#d9a441",
    imageUrl: typeof row.image_url === "string" && /^https?:\/\//i.test(row.image_url) ? row.image_url : "",
    sample: false,
    published: row.published ?? true,
    source: "db",
    aiGenerated: row.ai_generated ?? false,
    sources: Array.isArray(row.sources)
      ? row.sources.filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
      : [],
    aiNote: row.ai_note,
    updatedAt: row.updated_at,
    lastCheckedAt: row.last_checked_at,
    pendingRecheck: parsePendingRecheck(row.pending_recheck),
  };
}

function seedRecords(): PopupRecord[] {
  return SEED_POPUPS.map((p) => ({
    ...p,
    published: true,
    source: "seed" as const,
    aiGenerated: false,
    sources: [],
    aiNote: null,
    // 예시 시드는 실제로 확인한 정보가 아니라 확인 날짜가 없어요
    updatedAt: null,
    lastCheckedAt: null,
    pendingRecheck: null,
  }));
}

const COLUMNS =
  "id, brand, brand_en, title, summary, description, highlights, venue, address, city, start_date, end_date, hours, entry, reservation, links, whisky_ids, tags, accent, image_url, published, ai_generated, sources, ai_note, updated_at, last_checked_at, pending_recheck";

export async function listPopups(opts: { includeUnpublished?: boolean } = {}): Promise<PopupRecord[]> {
  try {
    const supabase = await createClient();
    let query = supabase.from("popup_stores").select(COLUMNS).order("start_date", { ascending: false });
    if (!opts.includeUnpublished) query = query.eq("published", true);

    const { data, error } = await query;
    // 테이블이 아직 없으면(스키마 미적용) 조용히 시드로 넘어가요
    if (error || !data || data.length === 0) return seedRecords();
    return (data as unknown as PopupRow[]).map(toRecord);
  } catch (error) {
    rethrowIfFrameworkError(error);
    // Supabase 설정이 없어도 화면은 살아 있어야 해요
    console.warn("[popup/store] DB를 읽지 못해 예시 시드를 씁니다", error);
    return seedRecords();
  }
}

export async function getPopup(id: string, opts: { includeUnpublished?: boolean } = {}): Promise<PopupRecord | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("popup_stores").select(COLUMNS).eq("id", id).maybeSingle();
    if (!error && data) {
      const record = toRecord(data as unknown as PopupRow);
      if (!record.published && !opts.includeUnpublished) return null;
      return record;
    }
  } catch (error) {
    rethrowIfFrameworkError(error);
    console.warn("[popup/store] DB를 읽지 못해 예시 시드를 씁니다", error);
  }
  return seedRecords().find((p) => p.id === id) ?? null;
}
