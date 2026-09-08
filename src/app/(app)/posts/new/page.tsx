import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WHISKIES } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "글 쓰기" };

export default async function NewPostPage({ searchParams }: PageProps<"/posts/new">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/posts/new");

  // 위스키 상세에서 "이 병 후기 쓰기" 로 들어오면 미리 골라둬요
  const { whisky } = await searchParams;
  const defaultWhiskyId = typeof whisky === "string" ? whisky : undefined;

  const options = WHISKIES.map((w) => ({ id: w.id, label: `${w.nameKo} (${w.name})` }));

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" render={<Link href="/posts" />}>
        <ArrowLeft className="size-4" aria-hidden />
        이야기 목록
      </Button>
      <div>
        <h1 className="text-2xl font-bold">글 쓰기</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          올리면 모두에게 보여요. 나만 보는 기록은{" "}
          <Link href="/journal" className="text-amber-300 hover:underline">
            테이스팅 노트
          </Link>
          에 남겨주세요 — 그건 취향 분석에 쓰여요.
        </p>
      </div>
      <Card>
        <CardContent className="p-5">
          <PostForm whiskies={options} defaultWhiskyId={defaultWhiskyId} />
        </CardContent>
      </Card>
    </div>
  );
}
