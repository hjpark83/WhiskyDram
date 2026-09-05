import type { Metadata } from "next";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PopupStatusBadge } from "@/components/popup/popup-card";
import { formatPeriod } from "@/lib/popup/format";
import { listPopups } from "@/lib/popup/store";
import { deletePopup, togglePublish } from "../actions";

export const metadata: Metadata = { title: "팝업 관리" };

export default async function AdminPopupsPage() {
  const popups = await listPopups({ includeUnpublished: true });
  const fromSeed = popups.every((p) => p.source === "seed");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl text-amber-100">팝업 {fromSeed ? "예시" : popups.length + "개"}</h2>
        <Button size="sm" render={<Link href="/admin/popups/new" />}>
          <Plus className="size-4" aria-hidden /> 새 팝업
        </Button>
      </div>

      {fromSeed && (
        <p className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-4 text-sm text-amber-50/85">
          아직 DB에 등록된 팝업이 없어서 코드의 예시를 보여주고 있어요. 대시보드에서 &ldquo;예시를 DB로
          복사&rdquo;를 누르면 여기서 바로 고칠 수 있어요.
        </p>
      )}

      <ul className="space-y-3">
        {popups.map((p) => (
          <li key={p.id}>
            <Card>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{p.brand}</Badge>
                    <PopupStatusBadge popup={p} />
                    {!p.published && <Badge variant="outline">비공개</Badge>}
                    {p.source === "seed" && (
                      <Badge variant="outline" className="border-dashed">
                        예시
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 truncate font-medium text-amber-50">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatPeriod(p)} · {p.city} {p.venue} · 위스키 {p.whiskyIds.length}병
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" render={<Link href={`/popup/${p.id}`} />}>
                    미리보기
                  </Button>
                  {p.source === "db" && (
                    <>
                      <Button size="sm" variant="outline" render={<Link href={`/admin/popups/${p.id}`} />}>
                        <Pencil className="size-3.5" aria-hidden /> 수정
                      </Button>
                      <form action={togglePublish}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="next" value={p.published ? "false" : "true"} />
                        <Button size="sm" variant="outline" type="submit">
                          {p.published ? (
                            <>
                              <EyeOff className="size-3.5" aria-hidden /> 숨기기
                            </>
                          ) : (
                            <>
                              <Eye className="size-3.5" aria-hidden /> 공개
                            </>
                          )}
                        </Button>
                      </form>
                      <form action={deletePopup}>
                        <input type="hidden" name="id" value={p.id} />
                        <Button size="sm" variant="outline" type="submit" className="text-destructive">
                          <Trash2 className="size-3.5" aria-hidden /> 삭제
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
