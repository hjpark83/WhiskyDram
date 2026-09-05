"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SEED_POPUPS } from "@/data/popups";
import { getAdminUser } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

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
      published: true,
      created_by: admin.id,
    })),
    { onConflict: "id" },
  );

  revalidatePath("/popup");
  revalidatePath("/admin/popups");
  revalidatePath("/home");
}
