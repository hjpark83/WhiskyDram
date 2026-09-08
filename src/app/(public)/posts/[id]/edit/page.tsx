import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WHISKIES } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/community/posts";
import { PostForm } from "../../post-form";

export const metadata: Metadata = { title: "글 수정" };

export default async function EditPostPage({ params }: PageProps<"/posts/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/posts/${id}/edit`);

  const post = await getPost(supabase, id, user.id);
  if (!post) notFound();
  // 남의 글 주소로 들어와도 수정 화면을 보여주지 않아요 (저장도 서버에서 다시 막아요)
  if (!post.mine) redirect(`/posts/${id}`);

  const options = WHISKIES.map((w) => ({ id: w.id, label: `${w.nameKo} (${w.name})` }));

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" render={<Link href={`/posts/${id}`} />}>
        <ArrowLeft className="size-4" aria-hidden />
        글로 돌아가기
      </Button>
      <h1 className="text-2xl font-bold">글 수정</h1>
      <Card>
        <CardContent className="p-5">
          <PostForm whiskies={options} post={post} />
        </CardContent>
      </Card>
    </div>
  );
}
