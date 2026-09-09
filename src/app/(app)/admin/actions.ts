"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SEED_POPUPS } from "@/data/popups";
import {
  recheckPopup,
  researchErrorMessage,
  researchPopups,
  whiskyIdsForBrand,
  type PopupDraft,
  type ResearchReport,
} from "@/lib/ai/popup-research";
import { applyChanges, diffRecheck, snapshot } from "@/lib/popup/recheck";
import { getPopup } from "@/lib/popup/store";
import { getWhisky } from "@/data/whiskies";
import { getAdminUser } from "@/lib/auth/admin";
import { searchCommons, type CommonsPhoto } from "@/lib/whisky/commons";
import { createClient } from "@/lib/supabase/server";
import { BOTTLE_PHOTO_BUCKET } from "@/lib/whisky/photos";

export type AdminState = { error?: string; message?: string } | null;

const LINK_KINDS = ["catchtable", "naver", "instagram", "official", "map"] as const;

/** "kind | 표시할 이름 | https://…" 한 줄에 하나 */
function parseLinkLines(raw: string) {
  const out: { kind: (typeof LINK_KINDS)[number]; label: string; url: string }[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("|").map((s) => s.trim());
    // 링크만 적어도 되게 (종류는 official 로)
    const url = parts.find((p) => /^https?:\/\//i.test(p));
    if (!url) continue;
    const kind = LINK_KINDS.find((k) => parts[0] === k) ?? "official";
    const label = parts.find((p) => p !== url && p !== kind) ?? "";
    out.push({ kind, label, url });
  }
  return out;
}

function lines(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function commas(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return base || `popup-${Date.now()}`;
}

const popupSchema = z.object({
  id: z.string().trim().max(80).optional(),
  brand: z.string().trim().min(1, { error: "브랜드를 입력해주세요." }).max(60),
  brandEn: z.string().trim().max(60).default(""),
  title: z.string().trim().min(1, { error: "제목을 입력해주세요." }).max(120),
  summary: z.string().trim().max(200).default(""),
  description: z.string().trim().max(2000).default(""),
  highlights: z.string().default(""),
  venue: z.string().trim().max(120).default(""),
  address: z.string().trim().max(200).default(""),
  city: z.string().trim().max(40).default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "시작일을 골라주세요." }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "종료일을 골라주세요." }),
  hours: z.string().trim().max(120).default(""),
  entry: z.string().trim().max(160).default(""),
  reservation: z.enum(["catchtable", "naver", "instagram", "walkin"]).default("walkin"),
  links: z.string().default(""),
  whiskyIds: z.string().default(""),
  tags: z.string().default(""),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "색은 #rrggbb 형식이어야 해요." })
    .default("#d9a441"),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//i.test(v), { error: "사진 주소는 https:// 로 시작해야 해요." })
    .default(""),
  published: z.boolean().default(true),
});

function readForm(formData: FormData) {
  const get = (k: string) => (formData.get(k) as string | null) ?? "";
  return popupSchema.safeParse({
    id: get("id"),
    brand: get("brand"),
    brandEn: get("brandEn"),
    title: get("title"),
    summary: get("summary"),
    description: get("description"),
    highlights: get("highlights"),
    venue: get("venue"),
    address: get("address"),
    city: get("city"),
    startDate: get("startDate"),
    endDate: get("endDate"),
    hours: get("hours"),
    entry: get("entry"),
    reservation: get("reservation") || "walkin",
    links: get("links"),
    whiskyIds: get("whiskyIds"),
    tags: get("tags"),
    accent: get("accent") || "#d9a441",
    imageUrl: get("imageUrl"),
    published: formData.get("published") === "on",
  });
}

export async function savePopup(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 등록할 수 있어요." };

  const parsed = readForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인해주세요." };
  }
  const v = parsed.data;
  if (v.endDate < v.startDate) {
    return { error: "종료일이 시작일보다 앞설 수 없어요." };
  }

  const id = v.id?.trim() || slugify(`${v.brand}-${v.title}`);
  const supabase = await createClient();
  const { error } = await supabase.from("popup_stores").upsert(
    {
      id,
      brand: v.brand,
      brand_en: v.brandEn,
      title: v.title,
      summary: v.summary,
      description: v.description,
      highlights: lines(v.highlights),
      venue: v.venue,
      address: v.address,
      city: v.city,
      start_date: v.startDate,
      end_date: v.endDate,
      hours: v.hours,
      entry: v.entry,
      reservation: v.reservation,
      links: parseLinkLines(v.links),
      whisky_ids: commas(v.whiskyIds),
      tags: commas(v.tags),
      accent: v.accent,
      image_url: v.imageUrl,
      published: v.published,
      created_by: admin.id,
    },
    { onConflict: "id" },
  );

  if (error) {
    // 테이블이 없을 때 가장 흔해요 — 무엇을 해야 하는지 알려줘요
    return {
      error: `저장에 실패했어요: ${error.message} (supabase/schema.sql 을 SQL Editor에서 실행했는지 확인해주세요.)`,
    };
  }

  revalidatePath("/popup");
  revalidatePath(`/popup/${id}`);
  revalidatePath("/admin/popups");
  revalidatePath("/home");
  return { message: "저장했어요." };
}

export async function deletePopup(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("popup_stores").delete().eq("id", id);
  revalidatePath("/popup");
  revalidatePath("/admin/popups");
  revalidatePath("/home");
}

export async function togglePublish(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;
  const id = (formData.get("id") as string | null)?.trim();
  const next = formData.get("next") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("popup_stores").update({ published: next }).eq("id", id);
  revalidatePath("/popup");
  revalidatePath("/admin/popups");
  revalidatePath("/home");
}

/**
 * 예시 시드를 DB로 복사해요. 처음 한 번 눌러두면 각 항목을 실제 정보로 고쳐 쓸 수 있어요.
 */
export async function importSeedPopups(): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const supabase = await createClient();
  await supabase.from("popup_stores").upsert(
    SEED_POPUPS.map((p) => ({
      id: p.id,
      brand: p.brand,
      brand_en: p.brandEn,
      title: p.title,
      summary: p.summary,
      description: p.description,
      highlights: p.highlights,
      venue: p.venue,
      address: p.address,
      city: p.city,
      start_date: p.startDate,
      end_date: p.endDate,
      hours: p.hours,
      entry: p.entry,
      reservation: p.reservation,
      links: p.links,
      whisky_ids: p.whiskyIds,
      tags: p.tags,
      accent: p.accent,
      image_url: p.imageUrl,
      published: true,
      created_by: admin.id,
    })),
    { onConflict: "id" },
  );

  revalidatePath("/popup");
  revalidatePath("/admin/popups");
  revalidatePath("/home");
}


// ---------------------------------------------------------------------------
// AI 로 팝업 찾기 (검색 그라운딩 → 초안 → 관리자가 확인하고 공개)
// ---------------------------------------------------------------------------

export type DiscoverState = { error?: string; report?: ResearchReport } | null;

export async function discoverPopups(_prev: DiscoverState, formData: FormData): Promise<DiscoverState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 쓸 수 있어요." };

  const brands = ((formData.get("brands") as string | null) ?? "")
    .split(/[,\n]/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 12);
  const region = ((formData.get("region") as string | null) ?? "").trim();

  try {
    const report = await researchPopups({ brands, region });
    return { report };
  } catch (error) {
    console.error("[admin/discover] 실패", error);
    return { error: researchErrorMessage(error) };
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function draftId(draft: PopupDraft): string {
  const base = slugify(`${draft.brand}-${draft.title}`).slice(0, 60);
  // 같은 행사를 두 번 저장해도 한 줄로 합쳐지게 기간을 붙여요
  return `${base || "popup"}-${draft.startDate || "tbd"}`;
}

export type SaveDraftsState = { error?: string; message?: string } | null;

/** 고른 후보만 **비공개** 초안으로 저장해요. 공개는 관리자가 따로 눌러야 해요. */
export async function saveDrafts(_prev: SaveDraftsState, formData: FormData): Promise<SaveDraftsState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 저장할 수 있어요." };

  let drafts: PopupDraft[];
  try {
    drafts = JSON.parse((formData.get("drafts") as string | null) ?? "[]") as PopupDraft[];
  } catch {
    return { error: "후보 데이터를 읽지 못했어요. 다시 검색해주세요." };
  }

  const rows = [];
  for (let i = 0; i < drafts.length; i++) {
    if (formData.get(`pick-${i}`) !== "on") continue;
    const draft = drafts[i];
    const startDate = ((formData.get(`start-${i}`) as string | null) ?? draft.startDate).trim();
    const endDate = ((formData.get(`end-${i}`) as string | null) ?? draft.endDate).trim();

    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      return { error: `"${draft.title}" 의 기간을 채워주세요. AI 가 기간을 확인하지 못했어요.` };
    }
    if (endDate < startDate) {
      return { error: `"${draft.title}" 의 종료일이 시작일보다 앞서요.` };
    }

    rows.push({
      id: draftId({ ...draft, startDate }),
      brand: draft.brand,
      brand_en: draft.brandEn,
      title: draft.title,
      summary: draft.summary,
      description: draft.description,
      highlights: draft.highlights,
      venue: draft.venue,
      address: draft.address,
      city: draft.city,
      start_date: startDate,
      end_date: endDate,
      hours: draft.hours,
      entry: draft.entry,
      reservation: draft.reservation,
      links: draft.sources.map((url) => ({ kind: "official", label: "출처", url })),
      whisky_ids: draft.whiskyIds.length > 0 ? draft.whiskyIds : whiskyIdsForBrand(draft.brand),
      tags: [],
      accent: "#d9a441",
      // 사람이 확인하기 전에는 사용자에게 보이지 않아요
      published: false,
      ai_generated: true,
      sources: draft.sources,
      ai_note: [draft.verifyNote, `AI 확신도: ${draft.confidence}`].filter(Boolean).join(" · "),
      created_by: admin.id,
    });
  }

  if (rows.length === 0) return { error: "저장할 항목을 골라주세요." };

  const supabase = await createClient();
  const { error } = await supabase.from("popup_stores").upsert(rows, { onConflict: "id" });
  if (error) {
    return { error: `저장에 실패했어요: ${error.message}` };
  }

  revalidatePath("/admin/popups");
  return {
    message: `${rows.length}개를 비공개 초안으로 저장했어요. 목록에서 내용을 확인하고 공개해주세요.`,
  };
}

// ---------------------------------------------------------------------------
// 시세 제보 관리
// ---------------------------------------------------------------------------

/** 엉터리 제보 지우기. 지울 권한은 RLS 로 막혀 있어요 (본인 것이거나 관리자). */
export async function removeReport(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const id = String(formData.get("id") ?? "");
  const whiskyId = String(formData.get("whiskyId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("price_reports").delete().eq("id", id);
  if (error) {
    console.warn(`[admin] 제보 삭제 실패 (${error.code ?? "?"}): ${error.message}`);
    return;
  }

  revalidatePath("/admin/prices");
  revalidatePath("/price");
  if (whiskyId) revalidatePath(`/price/${whiskyId}`);
}

// ---------------------------------------------------------------------------
// 병 사진 (사용자가 스캔하며 올린 실물 사진)
//   승인 전에는 올린 본인에게만 보여요. 여기서 확인한 것만 모두에게 공개돼요.
// ---------------------------------------------------------------------------

export async function approvePhoto(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const id = String(formData.get("id") ?? "");
  const whiskyId = String(formData.get("whiskyId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("whisky_photos").update({ approved: true }).eq("id", id);
  if (error) {
    console.warn(`[admin] 사진 승인 실패 (${error.code ?? "?"}): ${error.message}`);
    return;
  }

  revalidatePath("/admin/photos");
  if (whiskyId) revalidatePath(`/whisky/${whiskyId}`);
}

export async function rejectPhoto(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const id = String(formData.get("id") ?? "");
  const whiskyId = String(formData.get("whiskyId") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("whisky_photos").delete().eq("id", id);
  if (error) {
    console.warn(`[admin] 사진 삭제 실패 (${error.code ?? "?"}): ${error.message}`);
    return;
  }
  // 표에서 지웠으면 파일도 지워요 (주인 없는 파일이 남지 않게)
  if (path) await supabase.storage.from(BOTTLE_PHOTO_BUCKET).remove([path]);

  revalidatePath("/admin/photos");
  if (whiskyId) revalidatePath(`/whisky/${whiskyId}`);
}

// ---------------------------------------------------------------------------
// 위키미디어 커먼즈 사진 붙이기
//   자유 라이선스 사진만 붙일 수 있고, 출처·촬영자·라이선스를 함께 저장해요.
//   그게 라이선스가 요구하는 조건이라 안 지키면 쓸 수 없어요.
// ---------------------------------------------------------------------------

export type CommonsSearchState =
  | { error: string }
  | { whiskyId: string; query: string; photos: CommonsPhoto[] }
  | null;

export async function searchCommonsPhotos(
  _prev: CommonsSearchState,
  formData: FormData,
): Promise<CommonsSearchState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 쓸 수 있어요." };

  const whiskyId = String(formData.get("whiskyId") ?? "").trim();
  const whisky = getWhisky(whiskyId);
  if (!whisky) return { error: "위스키를 먼저 골라주세요." };

  // 영문 이름으로 찾아야 걸려요. 한글 이름으로는 커먼즈에 거의 없어요.
  const query = String(formData.get("query") ?? "").trim() || whisky.name;
  const { photos, error } = await searchCommons(query);
  if (error) return { error };
  if (photos.length === 0) {
    return { error: `"${query}" 로는 찾은 사진이 없어요. 검색어를 바꿔보세요.` };
  }
  return { whiskyId, query, photos };
}

// ---------------------------------------------------------------------------
// 여러 병을 한 번에
//
//   504병을 한 병씩 붙이는 건 현실적으로 못 해요. 사진이 아직 없는 병들을
//   모아 한 번에 찾아보고, 쓸 만한 후보를 골라 한꺼번에 붙이게 해요.
//   그래도 **고르는 건 사람**이에요 — 자동으로 붙이지 않아요.
// ---------------------------------------------------------------------------

export interface BatchCandidate {
  whiskyId: string;
  whiskyLabel: string;
  photo: CommonsPhoto | null;
  /** 후보를 못 찾았으면 이유 */
  note: string | null;
}

export type BatchState = { error: string } | { candidates: BatchCandidate[] } | null;

/** 커먼즈에 한꺼번에 몰아치지 않게 몇 개씩 끊어서 */
async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export async function findCommonsBatch(
  _prev: BatchState,
  formData: FormData,
): Promise<BatchState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 쓸 수 있어요." };

  const ids = String(formData.get("whiskyIds") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12); // 커먼즈에 한 번에 너무 많이 묻지 않아요
  if (ids.length === 0) return { error: "찾을 병이 없어요." };

  let reachError: string | null = null;
  const candidates = await inChunks(ids, 3, async (id): Promise<BatchCandidate> => {
    const w = getWhisky(id);
    if (!w) return { whiskyId: id, whiskyLabel: id, note: "사전에 없는 id", photo: null };
    const label = `${w.nameKo} (${w.name})`;
    const { photos, error } = await searchCommons(w.name, 6);
    if (error) {
      reachError = error;
      return { whiskyId: id, whiskyLabel: label, note: error, photo: null };
    }
    const best = photos.find((p) => p.usable) ?? null;
    return {
      whiskyId: id,
      whiskyLabel: label,
      photo: best,
      note: best ? null : "쓸 수 있는 라이선스의 사진이 없어요",
    };
  });

  if (reachError && candidates.every((c) => !c.photo)) return { error: reachError };
  return { candidates };
}

export async function attachCommonsBatch(
  _prev: AttachState,
  formData: FormData,
): Promise<AttachState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 쓸 수 있어요." };

  // 체크한 것만 붙여요. 값은 "whiskyId|imageUrl|sourceUrl|license|credit" 한 줄.
  const picked = formData.getAll("pick").map(String).filter(Boolean);
  if (picked.length === 0) return { error: "고른 사진이 없어요." };

  const supabase = await createClient();
  const rows = [];
  for (const raw of picked) {
    const [whiskyId, imageUrl, sourceUrl, license, credit = ""] = raw.split("|");
    if (!getWhisky(whiskyId) || !imageUrl || !sourceUrl || !license) continue;
    rows.push({
      whisky_id: whiskyId,
      user_id: admin.id,
      image_url: imageUrl,
      source: "commons",
      source_url: sourceUrl,
      credit: credit || null,
      license,
      approved: true,
    });
  }
  if (rows.length === 0) return { error: "붙일 수 있는 사진이 없어요." };

  const { error } = await supabase.from("whisky_photos").insert(rows);
  if (error) {
    if (error.code === "42703" || error.code === "42P01") {
      return { error: "사진 표가 최신이 아니에요. supabase/schema.sql 을 다시 실행해주세요." };
    }
    return { error: `붙이지 못했어요 (${error.code ?? "?"}). ${error.message}` };
  }

  for (const r of rows) revalidatePath(`/whisky/${r.whisky_id}`);
  revalidatePath("/admin/photos");
  return { message: `${rows.length}장 붙였어요.` };
}

export type AttachState = { error?: string; message?: string } | null;

export async function attachCommonsPhoto(
  _prev: AttachState,
  formData: FormData,
): Promise<AttachState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 쓸 수 있어요." };

  const whiskyId = String(formData.get("whiskyId") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const credit = String(formData.get("credit") ?? "").trim();
  const license = String(formData.get("license") ?? "").trim();

  if (!getWhisky(whiskyId)) return { error: "위스키를 찾지 못했어요." };
  if (!imageUrl || !sourceUrl || !license) {
    return { error: "출처와 라이선스가 없는 사진은 붙일 수 없어요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("whisky_photos").insert({
    whisky_id: whiskyId,
    user_id: admin.id,
    image_url: imageUrl,
    source: "commons",
    source_url: sourceUrl,
    credit: credit || null,
    license,
    // 관리자가 라이선스를 보고 직접 고른 것이라 바로 공개해요
    approved: true,
  });
  if (error) {
    if (error.code === "23505") return { error: "이미 붙어 있는 사진이에요." };
    if (error.code === "42703" || error.code === "42P01") {
      return { error: "사진 표가 최신이 아니에요. supabase/schema.sql 을 다시 실행해주세요." };
    }
    return { error: `붙이지 못했어요 (${error.code ?? "?"}). ${error.message}` };
  }

  revalidatePath(`/whisky/${whiskyId}`);
  revalidatePath("/admin/photos");
  return { message: "붙였어요. 위스키 화면에 바로 보여요." };
}

// ---------------------------------------------------------------------------
// 관리자 명단
// ---------------------------------------------------------------------------

/**
 * 관리자 추가.
 *
 * 명단(admin_emails)에 넣고, **이미 가입한 계정이면 그 자리에서** 올려줘요.
 * 명단만 넣으면 다음 가입 때부터 적용돼서, 이미 있는 계정은 아무 일도 안 일어나요.
 */
export async function addAdminEmail(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_emails")
    .upsert({ email, note: note || null }, { onConflict: "email" });
  if (error) {
    console.warn(`[admin] 명단 추가 실패 (${error.code ?? "?"}): ${error.message}`);
    return;
  }

  // 이미 가입한 계정이면 지금 바로 올려요 (auth.users 는 직접 못 읽어서 함수를 써요)
  const { error: promoteError } = await supabase.rpc("admin_promote_email", { target_email: email });
  if (promoteError) {
    console.warn(`[admin] 즉시 승격 실패 (${promoteError.code ?? "?"}): ${promoteError.message}`);
  }

  revalidatePath("/admin/admins");
}

/** 명단에서 빼기. 이미 붙은 권한도 같이 거둬요. */
export async function removeAdminEmail(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  // 자기 자신은 못 빼요 — 관리자가 0명이 되면 아무도 못 들어가요
  if (email === (admin.email ?? "").toLowerCase()) return;

  const supabase = await createClient();
  await supabase.from("admin_emails").delete().eq("email", email);
  const { error } = await supabase.rpc("admin_revoke_email", { target_email: email });
  if (error) {
    console.warn(`[admin] 권한 회수 실패 (${error.code ?? "?"}): ${error.message}`);
  }

  revalidatePath("/admin/admins");
}

// ---------------------------------------------------------------------------
// 팝업 재확인 (주기적으로 웹에서 다시 보고, 바뀐 것만 제안으로 쌓아요)
// ---------------------------------------------------------------------------

/**
 * 팝업 하나를 지금 다시 확인해요.
 *
 * 값을 바로 고치지 않고 **제안**으로 저장해요 (`pending_recheck`).
 * 공개된 정보를 AI 가 말없이 바꾸면, 사람이 확인하고 공개한다는 원칙이
 * 무의미해지니까요. 자세한 이유는 `src/lib/popup/recheck.ts` 주석에 있어요.
 */
export async function recheckOne(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 할 수 있어요." };
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "어떤 팝업인지 알 수 없어요." };

  const popup = await getPopup(id, { includeUnpublished: true });
  if (!popup) return { error: "그 팝업을 찾지 못했어요." };
  if (popup.source === "seed") {
    // 시드는 코드에 있는 예시라 DB 에 쓸 행이 없어요
    return { error: "예시 팝업은 재확인할 수 없어요. 먼저 대시보드에서 DB로 복사해주세요." };
  }

  let pending;
  try {
    pending = diffRecheck(popup, await recheckPopup(snapshot(popup)));
  } catch (error) {
    return { error: researchErrorMessage(error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("popup_stores")
    .update({ last_checked_at: pending.checkedAt, pending_recheck: pending })
    .eq("id", id);
  if (error) return { error: `저장에 실패했어요: ${error.message}` };

  revalidatePath("/admin/popups");
  revalidatePath(`/admin/popups/${id}`);
  revalidatePath(`/popup/${id}`);

  if (pending.notFound) return { message: "웹에서 이 행사를 찾지 못했어요. 값은 그대로 뒀어요." };
  if (pending.changes.length === 0) return { message: "확인했어요. 바뀐 게 없어요." };
  return { message: `바뀐 것 ${pending.changes.length}개를 찾았어요. 아래에서 확인하고 적용해주세요.` };
}

/** 제안 중 고른 것만 실제 값에 반영해요 */
export async function applyRecheck(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "관리자만 할 수 있어요." };
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "어떤 팝업인지 알 수 없어요." };

  const popup = await getPopup(id, { includeUnpublished: true });
  const pending = popup?.pendingRecheck;
  if (!popup || !pending) return { error: "적용할 제안이 없어요." };

  // 체크된 것만. 관리자가 "종료일은 맞는데 장소는 아니다" 를 가를 수 있어야 해요.
  const picked = pending.changes.filter((c) => formData.get(`pick-${c.field}`) === "on");
  if (picked.length === 0) return { error: "적용할 항목을 골라주세요." };

  const patch = applyChanges(picked);
  if (Object.keys(patch).length === 0) return { error: "적용할 수 있는 값이 없어요." };

  // 기간을 고칠 때는 시작·종료가 뒤집히지 않는지 봐요 (DB 제약에 걸려요)
  const start = patch.start_date ?? popup.startDate;
  const end = patch.end_date ?? popup.endDate;
  if (end < start) {
    return { error: `종료일(${end})이 시작일(${start})보다 앞서요. 둘 다 골라서 함께 적용해주세요.` };
  }

  // 남은 제안만 유지 — 고르지 않은 항목은 다음에 다시 볼 수 있게 남겨둬요
  const rest = pending.changes.filter((c) => !picked.some((p) => p.field === c.field));
  const supabase = await createClient();
  const { error } = await supabase
    .from("popup_stores")
    .update({
      ...patch,
      pending_recheck: rest.length > 0 ? { ...pending, changes: rest } : null,
    })
    .eq("id", id);
  if (error) return { error: `저장에 실패했어요: ${error.message}` };

  revalidatePath("/admin/popups");
  revalidatePath(`/admin/popups/${id}`);
  revalidatePath("/popup");
  revalidatePath(`/popup/${id}`);
  return {
    message:
      rest.length > 0
        ? `${picked.length}개를 반영했어요. 고르지 않은 ${rest.length}개는 남겨뒀어요.`
        : `${picked.length}개를 반영했어요.`,
  };
}

/** 제안을 버려요 (값은 그대로). 확인 시각은 남겨서 바로 또 재확인하지 않게 해요. */
export async function dismissRecheck(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("popup_stores").update({ pending_recheck: null }).eq("id", id);
  revalidatePath("/admin/popups");
  revalidatePath(`/admin/popups/${id}`);
}
