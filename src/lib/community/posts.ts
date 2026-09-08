import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 공개 후기 글과 댓글.
 *
 * `tasting_notes` 와 헷갈리기 쉬운데 목적이 달라요.
 *  - 노트: **나만 보는 기록**. 취향 벡터를 갱신해요.
 *  - 글: **남에게 보여주는 글**. 취향 벡터를 건드리지 않아요.
 * 같은 병에 대해 둘 다 써도 돼요.
 */

export const POST_TITLE_MAX = 80;
export const POST_BODY_MAX = 8000;
export const COMMENT_BODY_MAX = 1000;

export interface Post {
  id: string;
  userId: string;
  whiskyId: string | null;
  title: string;
  body: string;
  rating: number | null;
  authorName: string;
  /** 지금 보고 있는 사람이 쓴 글인지 (수정·삭제 버튼용) */
  mine: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  authorName: string;
  /** 내가 쓴 댓글이거나, 내 글에 달린 댓글이면 지울 수 있어요 */
  canDelete: boolean;
  createdAt: string;
}

interface PostRow {
  id: string;
  user_id: string;
  whisky_id: string | null;
  title: string;
  body: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

/** 표가 아직 없는 배포에서도 화면이 죽지 않게 (schema.sql 을 안 돌린 상태) */
function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "42883";
}

/**
 * 사용자 id → 표시 이름.
 *
 * `profiles` 는 본인만 읽을 수 있어서 (취향 벡터가 들어 있어요) 이름만
 * 돌려주는 `author_names()` 함수를 따로 써요.
 */
async function authorNames(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;

  const { data, error } = await supabase.rpc("author_names", { ids: unique });
  if (error) {
    if (!isMissingTable(error.code)) console.error("[posts] author_names failed", error);
    return out;
  }
  for (const row of (data ?? []) as { id: string; display_name: string | null }[]) {
    if (row.display_name) out.set(row.id, row.display_name);
  }
  return out;
}

/** 이름을 못 읽었을 때 쓰는 표시 (이메일은 절대 노출하지 않아요) */
const UNKNOWN_AUTHOR = "이름 없는 위스키러";

async function decorate(
  supabase: SupabaseClient,
  rows: PostRow[],
  viewerId: string | null,
): Promise<Post[]> {
  if (rows.length === 0) return [];

  const [names, counts] = await Promise.all([
    authorNames(supabase, rows.map((r) => r.user_id)),
    commentCounts(supabase, rows.map((r) => r.id)),
  ]);

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    whiskyId: r.whisky_id,
    title: r.title,
    body: r.body,
    rating: r.rating,
    authorName: names.get(r.user_id) ?? UNKNOWN_AUTHOR,
    mine: r.user_id === viewerId,
    commentCount: counts.get(r.id) ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * 글마다 댓글 수.
 *
 * 글 하나씩 세면 목록에서 요청이 글 개수만큼 나가요. 한 번에 가져와서 세요.
 */
async function commentCounts(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (postIds.length === 0) return out;

  const { data, error } = await supabase
    .from("post_comments")
    .select("post_id")
    .in("post_id", postIds);
  if (error) {
    if (!isMissingTable(error.code)) console.error("[posts] comment count failed", error);
    return out;
  }
  for (const row of (data ?? []) as { post_id: string }[]) {
    out.set(row.post_id, (out.get(row.post_id) ?? 0) + 1);
  }
  return out;
}

const POST_COLUMNS = "id, user_id, whisky_id, title, body, rating, created_at, updated_at";

export async function listPosts(
  supabase: SupabaseClient,
  opts: { whiskyId?: string; authorId?: string; limit?: number; viewerId?: string | null } = {},
): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 30);

  if (opts.whiskyId) query = query.eq("whisky_id", opts.whiskyId);
  if (opts.authorId) query = query.eq("user_id", opts.authorId);

  const { data, error } = await query;
  if (error) {
    if (!isMissingTable(error.code)) console.error("[posts] list failed", error);
    return [];
  }
  return decorate(supabase, (data ?? []) as PostRow[], opts.viewerId ?? null);
}

export async function getPost(
  supabase: SupabaseClient,
  id: string,
  viewerId: string | null,
): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (!isMissingTable(error.code)) console.error("[posts] get failed", error);
    return null;
  }
  if (!data) return null;
  const [post] = await decorate(supabase, [data as PostRow], viewerId);
  return post ?? null;
}

export async function listComments(
  supabase: SupabaseClient,
  postId: string,
  viewerId: string | null,
  postAuthorId: string | null,
): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) {
    if (!isMissingTable(error.code)) console.error("[posts] comments failed", error);
    return [];
  }

  const rows = (data ?? []) as CommentRow[];
  const names = await authorNames(supabase, rows.map((r) => r.user_id));

  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    userId: r.user_id,
    body: r.body,
    authorName: names.get(r.user_id) ?? UNKNOWN_AUTHOR,
    // 내 댓글이거나 내 글에 달린 댓글 (관리자 권한은 서버에서 다시 확인해요)
    canDelete: Boolean(viewerId) && (r.user_id === viewerId || postAuthorId === viewerId),
    createdAt: r.created_at,
  }));
}

/** 목록에 보여줄 짧은 미리보기 */
export function excerpt(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}
