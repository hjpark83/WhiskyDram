import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWhisky } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { excerpt, listPosts } from "@/lib/community/posts";

export const metadata: Metadata = { title: "위스키 이야기" };

export default async function PostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const posts = await listPosts(supabase, { viewerId: user?.id ?? null, limit: 40 });
  // 로그인 안 해도 읽을 수 있어요. 쓰기만 로그인이 필요해서 버튼 문구를 바꿔요.
  const writeHref = user ? "/posts/new" : "/login?next=/posts/new";

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">위스키 이야기</h1>
          <p className="mt-1 text-muted-foreground">
            마셔본 이야기를 편하게 남기는 곳이에요. 어려운 용어 없이 써도 괜찮아요.
            {!user && " 읽는 건 로그인 없이도 돼요."}
          </p>
        </div>
        <Button size="sm" render={<Link href={writeHref} />}>
          <PenLine className="size-4" aria-hidden />
          {user ? "글 쓰기" : "로그인하고 글 쓰기"}
        </Button>
      </section>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">아직 올라온 글이 없어요.</p>
            <p className="text-sm text-muted-foreground">
              첫 글을 남겨주세요. 별점도 병 선택도 안 해도 괜찮아요.
            </p>
            <Button size="sm" variant="outline" render={<Link href={writeHref} />}>
              {user ? "첫 글 쓰기" : "로그인하고 첫 글 쓰기"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const whisky = post.whiskyId ? getWhisky(post.whiskyId) : undefined;
            return (
              <li key={post.id}>
                <Link href={`/posts/${post.id}`} className="block">
                  <Card className="transition hover:border-amber-400/40">
                    <CardContent className="space-y-2 p-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-amber-200/90">{post.authorName}</span>
                        <span aria-hidden>·</span>
                        <time dateTime={post.createdAt}>
                          {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                        </time>
                        {whisky && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{whisky.nameKo}</span>
                          </>
                        )}
                        {post.rating !== null && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="text-amber-300">
                              {"★".repeat(post.rating)}
                              <span className="text-muted-foreground">
                                {"★".repeat(5 - post.rating)}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                      <h2 className="font-semibold">{post.title}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {excerpt(post.body)}
                      </p>
                      {post.commentCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          댓글 {post.commentCount}개
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
