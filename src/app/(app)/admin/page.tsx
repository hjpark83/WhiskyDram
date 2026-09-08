import type { Metadata } from "next";
import Link from "next/link";
import { Database, Plus, Sparkles, Stethoscope, Store, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FEATURES } from "@/data/features";
import { getOverview, getTopWhiskies } from "./stats";
import { getWhisky, WHISKIES } from "@/data/whiskies";
import { activeProvider } from "@/lib/ai/provider";
import { popupStatus } from "@/lib/popup/format";
import { listPopups } from "@/lib/popup/store";
import { importSeedPopups } from "./actions";

export const metadata: Metadata = { title: "관리자" };

export default async function AdminDashboardPage() {
  // 꺼져 있으면 DB를 건드리지 않아요
  const popups = FEATURES.popup ? await listPopups({ includeUnpublished: true }) : [];
  const fromSeed = popups.every((p) => p.source === "seed");
  const ongoing = popups.filter((p) => popupStatus(p) === "ongoing").length;
  const upcoming = popups.filter((p) => popupStatus(p) === "upcoming").length;
  const aiProvider = activeProvider();
  const [overview, topWhiskies] = await Promise.all([getOverview(), getTopWhiskies(8)]);

  return (
    <div className="space-y-6">
      {overview ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg text-amber-100">한눈에 보기</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="가입자" value={overview.users} note={`최근 7일 +${overview.usersNew7d}`} />
              <Stat label="취향 진단 완료" value={overview.withTaste} note={`내 정보까지 채운 사람 ${overview.withPersona}`} />
              <Stat label="테이스팅 노트" value={overview.notes} note={`최근 7일 +${overview.notes7d}`} />
              <Stat
                label="시세 제보"
                value={overview.priceReports}
                note={`${overview.pricedWhiskies}병 · 최근 7일 +${overview.priceReports7d}`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              개인 기록은 관리자도 못 봐요 (RLS). 여기 숫자는 집계만 돌려주는 함수에서 와요.
            </p>
          </section>

          {topWhiskies.length > 0 && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <h2 className="text-lg text-amber-100">기록이 많은 위스키</h2>
                <ol className="space-y-1 text-sm">
                  {topWhiskies.map((t, i) => (
                    <li key={t.whiskyId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-amber-50/90">
                        <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}</span>
                        {getWhisky(t.whiskyId)?.nameKo ?? t.whiskyId}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        노트 {t.notes}개{t.avgRating !== null ? ` · 평균 ★${t.avgRating}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-amber-50/85">
            통계를 읽지 못했어요. <code className="text-amber-300">supabase/schema.sql</code> 을 최신으로 한 번 더
            실행해주세요 — 집계 함수(<code className="text-amber-300">admin_overview</code>)가 이번에 추가됐어요.
          </CardContent>
        </Card>
      )}
      {FEATURES.popup && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="등록된 팝업" value={fromSeed ? 0 : popups.length} note={fromSeed ? "예시 데이터만 표시 중" : undefined} />
          <Stat label="진행 중" value={ongoing} />
          <Stat label="오픈 예정" value={upcoming} />
        </div>
      )}

      {FEATURES.popup && (
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
            <Button size="sm" variant="outline" render={<Link href="/admin/popups/discover" />}>
              <Sparkles className="size-4" aria-hidden /> AI로 찾기
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-amber-100">
            <Stethoscope className="size-4 text-amber-400" aria-hidden />
            <h2 className="text-lg">AI 점검</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {aiProvider
              ? `지금은 ${aiProvider.label}(${aiProvider.model})로 돌아요. 키가 있어도 모델 이름이나 응답 형식이 안 맞으면 조용히 규칙 기반 결과로 넘어가니, 배포 후 한 번 눌러 확인해주세요.`
              : "AI 키가 없어서 추천·채팅·스캔이 모두 규칙 기반 결과로 돌아가요. 환경변수를 넣은 뒤 여기서 확인해주세요."}
          </p>
          <Button size="sm" variant="outline" render={<Link href="/admin/ai" />}>
            <Stethoscope className="size-4" aria-hidden /> AI 점검 열기
          </Button>
        </CardContent>
      </Card>

      {FEATURES.popup && fromSeed && (
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
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-amber-100">
            <Tag className="size-4 text-amber-400" aria-hidden />
            <h2 className="text-lg">시세 제보</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            사용자가 올린 시세를 보고, 명백히 잘못된 값만 지워요. 지우면 중간값이 바로 다시 계산돼요.
          </p>
          <Button size="sm" variant="outline" render={<Link href="/admin/prices" />}>
            제보 관리
          </Button>
        </CardContent>
      </Card>

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
