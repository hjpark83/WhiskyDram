import type { Metadata } from "next";
import Link from "next/link";
import { Database, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WHISKIES } from "@/data/whiskies";
import { popupStatus } from "@/lib/popup/format";
import { listPopups } from "@/lib/popup/store";
import { importSeedPopups } from "./actions";

export const metadata: Metadata = { title: "관리자" };

export default async function AdminDashboardPage() {
  const popups = await listPopups({ includeUnpublished: true });
  const fromSeed = popups.every((p) => p.source === "seed");
  const ongoing = popups.filter((p) => popupStatus(p) === "ongoing").length;
  const upcoming = popups.filter((p) => popupStatus(p) === "upcoming").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="등록된 팝업" value={fromSeed ? 0 : popups.length} note={fromSeed ? "예시 데이터만 표시 중" : undefined} />
        <Stat label="진행 중" value={ongoing} />
        <Stat label="오픈 예정" value={upcoming} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-amber-100">
            <Store className="size-4 text-amber-400" aria-hidden />
            <h2 className="text-lg">팝업 스토어</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            브랜드 팝업 정보를 직접 등록해요. 캐치테이블·네이버 예약 링크를 넣으면 사용자가 상세
            페이지에서 바로 넘어갈 수 있어요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" render={<Link href="/admin/popups/new" />}>
              <Plus className="size-4" aria-hidden /> 새 팝업 등록
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/admin/popups" />}>
              목록 보기
            </Button>
          </div>
        </CardContent>
      </Card>

      {fromSeed && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-amber-100">
              <Database className="size-4 text-amber-400" aria-hidden />
              <h2 className="text-lg">예시 데이터 가져오기</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              지금은 코드에 들어 있는 예시 팝업 {popups.length}개를 보여주고 있어요. 아래 버튼을 누르면
              DB로 복사돼서 하나하나 실제 정보로 고칠 수 있어요.
            </p>
            <form action={importSeedPopups}>
              <Button type="submit" size="sm" variant="outline">
                예시 {popups.length}개를 DB로 복사
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="text-lg text-amber-100">위스키 사전</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            사전은 저장소의 정적 데이터예요 (<code className="text-amber-300">src/data/whiskies.ts</code>,
            현재 {WHISKIES.length}병). 병을 추가하려면 코드에서 고치고 배포해요 — DB에는 사용자 기록만 둬요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl tabular-nums text-amber-200">{value}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
