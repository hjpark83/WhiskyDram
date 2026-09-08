"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWhisky } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { COMMENT_BODY_MAX, POST_BODY_MAX, POST_TITLE_MAX } from "@/lib/community/posts";

export type PostFormState = { error?: string } | null;

const postSchema = z.object({
  title: z.string().trim().min(2, "제목을 2자 이상 적어주세요.").max(POST_TITLE_MAX),
  body: z.string().trim().min(10, "내용을 10자 이상 적어주세요.").max(POST_BODY_MAX),
  // 자유 주제 글도 있으니 병 선택은 선택 사항이에요
  whiskyId: z.string().trim().optional(),
  rating: z.string().trim().optional(),
});

function parseRating(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** 사전에 없는 id 가 들어오면 병 연결만 버려요 (글은 살려요) */
function safeWhiskyId(raw: string | undefined): string | null {
  const id = raw?.trim();
  if (!id) return null;
  return getWhisky(id) ? id : null;
}

function readForm(formData: FormData) {
  return postSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    whiskyId: String(formData.get("whiskyId") ?? ""),
    rating: String(formData.get("rating") ?? ""),
  });
}

function writeErrorMessage(code: string | undefined, message: string): string {
  // 무엇을 해야 하는지 알 수 있게 원인별로 다르게 적어요
  if (code === "42P01" || code === "42883") {
    return "글 표가 아직 없어요. supabase/schema.sql 을 SQL Editor 에서 실행해주세요.";
  }
  if (code === "42501") return "권한이 없어요. 로그인 상태를 확인해주세요.";
  return `저장하지 못했어요${code ? ` (${code})` : ""}. ${message}`;
}

export async function createPost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const parsed = readForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/posts/new");

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      whisky_id: safeWhiskyId(parsed.data.whiskyId),
      rating: parseRating(parsed.data.rating),
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: writeErrorMessage(error.code, error.message) };
  if (!data) return { error: "저장된 글이 없어요. 잠시 후 다시 시도해주세요." };

  revalidatePath("/posts");
  redirect(`/posts/${data.id}`);
}

export async function updatePost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "글을 찾지 못했어요." };

  const parsed = readForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/posts/${id}/edit`);

  // 남의 글을 못 고치게 조건을 하나 더 걸어요 (RLS 와 이중으로)
  const { data, error } = await supabase
    .from("posts")
    .update({
      title: parsed.data.title,
      body: parsed.data.body,
      whisky_id: safeWhiskyId(parsed.data.whiskyId),
      rating: parseRating(parsed.data.rating),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { error: writeErrorMessage(error.code, error.message) };
  if (!data) return { error: "내 글이 아니거나 이미 지워진 글이에요." };

  revalidatePath("/posts");
  revalidatePath(`/posts/${id}`);
  redirect(`/posts/${id}`);
}

export async function deletePost(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS 가 본인·관리자만 지우게 막고 있어요
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) {
    console.warn(`[posts] 삭제 실패 (${error.code ?? "?"}): ${error.message}`);
    return;
  }

  revalidatePath("/posts");
  redirect("/posts");
}

export type CommentFormState = { error?: string } | null;

export async function addComment(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!postId) return { error: "글을 찾지 못했어요." };
  if (body.length < 2) return { error: "댓글을 2자 이상 적어주세요." };
  if (body.length > COMMENT_BODY_MAX) {
    return { error: `댓글은 ${COMMENT_BODY_MAX}자까지 쓸 수 있어요.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/posts/${postId}`);

  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: user.id, body });
  if (error) return { error: writeErrorMessage(error.code, error.message) };

  revalidatePath(`/posts/${postId}`);
  return null;
}

export async function deleteComment(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const postId = String(formData.get("postId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS 가 본인·글쓴이·관리자만 지우게 막고 있어요
  const { error } = await supabase.from("post_comments").delete().eq("id", id);
  if (error) {
    console.warn(`[posts] 댓글 삭제 실패 (${error.code ?? "?"}): ${error.message}`);
    return;
  }
  if (postId) revalidatePath(`/posts/${postId}`);
}
