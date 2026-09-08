import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWhisky } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { BOTTLE_PHOTO_BUCKET } from "@/lib/whisky/photos";
import { approvePhoto, rejectPhoto } from "../actions";

export const metadata: Metadata = { title: "병 사진 확인" };

interface Row {
  id: string;
  whisky_id: string;
  storage_path: string;
  approved: boolean;
  created_at: string;
}

export default async function AdminPhotosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whisky_photos")
    .select("id, whisky_id, storage_path, approved, created_at")
    .eq("approved", false)
    .order("created_at", { ascending: false })
    .limit(60);

  const pending = (data ?? []) as Row[];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl text-amber-100">병 사진 확인</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          사용자가 병을 스캔할 때 올린 실물 사진이에요. 확인한 사진만 모두에게 보여요. 확인 전에는
          올린 본인에게만 보이고요.
        </p>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <div className="space-y-1 text-amber-50/85">
          <p>
            <strong>병이 맞는지</strong>와 <strong>사람 얼굴·개인정보가 안 찍혔는지</strong> 두 가지만
            봐주세요. 사진이 흐리거나 예쁘지 않은 건 지울 이유가 아니에요 — 실제로 그 병을 산
            사람이 찍은 사진이라는 게 중요해요.
          </p>
          <p>엉뚱한 병에 붙었거나 병이 아닌 사진이면 지워주세요.</p>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            사진 표를 읽지 못했어요 ({error.code ?? "?"}). <code>supabase/schema.sql</code> 을 아직 안
            돌렸다면 SQL Editor 에서 실행해주세요.
          </CardContent>
        </Card>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            확인할 사진이 없어요. 누군가{" "}
            <Link href="/scan" className="text-amber-300 hover:underline">
              병 스캔
            </Link>
            으로 사진을 올리면 여기에 쌓여요.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((row) => {
            const whisky = getWhisky(row.whisky_id);
            const { data: pub } = supabase.storage
              .from(BOTTLE_PHOTO_BUCKET)
              .getPublicUrl(row.storage_path);
            return (
              <li key={row.id}>
                <Card className="overflow-hidden">
                  <div className="relative aspect-[3/4] bg-black/30">
                    <Image
                      src={pub.publicUrl}
                      alt={`${whisky?.nameKo ?? row.whisky_id} 사진`}
                      fill
                      sizes="(max-width: 640px) 100vw, 320px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <CardContent className="space-y-3 p-3">
                    <div className="min-w-0">
                      {whisky ? (
                        <Link
                          href={`/whisky/${whisky.id}`}
                          className="truncate text-sm font-medium text-amber-200 hover:underline"
                        >
                          {whisky.nameKo}
                        </Link>
                      ) : (
                        // 사전에서 빠진 id (사전을 손본 뒤에 생길 수 있어요)
                        <p className="truncate text-sm text-muted-foreground">
                          사전에 없는 id: {row.whisky_id}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={approvePhoto} className="flex-1">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="whiskyId" value={row.whisky_id} />
                        <Button type="submit" size="sm" className="w-full">
                          <Check className="size-4" aria-hidden />
                          공개
                        </Button>
                      </form>
                      <form action={rejectPhoto}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="whiskyId" value={row.whisky_id} />
                        <input type="hidden" name="path" value={row.storage_path} />
                        <Button type="submit" size="sm" variant="outline">
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only">지우기</span>
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
