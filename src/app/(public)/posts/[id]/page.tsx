import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWhisky } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { excerpt, getPost, listComments } from "@/lib/community/posts";
import { formatPriceRange } from "@/lib/whisky/format";
import { deletePost } from "../actions";
import { Comments } from "./comments";

export async function generateMetadata({ params }: PageProps<"/posts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const post = await getPost(supabase, id, null);
  if (!post) return { title: "글" };
  return { title: post.title, description: excerpt(post.body, 120) };
}

export default async function PostPage({ params }: PageProps<"/posts/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const post = await getPost(supabase, id, user?.id ?? null);
  if (!post) notFound();

  const comments = await listComments(supabase, post.id, user?.id ?? null, post.userId);
  const whisky = post.whiskyId ? getWhisky(post.whiskyId) : undefined;
  const edited = post.updatedAt !== post.createdAt;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/posts" />}>
        <ArrowLeft className="size-4" aria-hidden />
        이야기 목록
      </Button>

      <article className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="text-amber-200/90">{post.authorName}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.createdAt}>
              {new Date(post.createdAt).toLocaleDateString("ko-KR")}
            </time>
            {edited && <span className="text-xs">(수정됨)</span>}
            {post.rating !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="text-amber-300">
                  {"★".repeat(post.rating)}
                  <span className="text-muted-foreground">{"★".repeat(5 - post.rating)}</span>
                </span>
              </>
            )}
          </div>
        </header>

        {whisky && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">이 글이 다루는 병</p>
                <p className="truncate font-medium">{whisky.nameKo}</p>
                <p className="text-xs text-muted-foreground">
                  {whisky.abv}% · {formatPriceRange(whisky.priceKrw)}
                </p>
              </div>
              <Button size="sm" variant="outline" render={<Link href={`/whisky/${whisky.id}`} />}>
                병 정보 보기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 사용자가 쓴 글이라 HTML 로 해석하지 않고 글자 그대로 보여줘요 */}
        <div className="whitespace-pre-wrap text-[15px] leading-7">{post.body}</div>

        {post.mine && (
          <div className="flex gap-2 border-t pt-4">
            <Button size="sm" variant="outline" render={<Link href={`/posts/${post.id}/edit`} />}>
              <Pencil className="size-4" aria-hidden />
              수정
            </Button>
            <form action={deletePost}>
              <input type="hidden" name="id" value={post.id} />
              <Button type="submit" size="sm" variant="ghost">
                <Trash2 className="size-4" aria-hidden />
                지우기
              </Button>
            </form>
          </div>
        )}
      </article>

      <Comments postId={post.id} comments={comments} signedIn={Boolean(user)} />
    </div>
  );
}
