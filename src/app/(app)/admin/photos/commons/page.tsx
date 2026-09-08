import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WHISKIES } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { storyFor } from "@/lib/whisky/explain";
import { BatchFinder } from "./batch-finder";
import { CommonsFinder } from "./commons-finder";

export const metadata: Metadata = { title: "커먼즈에서 사진 찾기" };

export default async function AdminCommonsPage() {
  // 이미 사진이 있는 병은 빼요
  const supabase = await createClient();
  const { data } = await supabase.from("whisky_photos").select("whisky_id");
  const has = new Set((data ?? []).map((r) => (r as { whisky_id: string }).whisky_id));

  /**
   * 한 번에 채울 후보. 사람들이 실제로 열어보는 병부터예요 —
   * 브랜드 이야기가 붙어 있고(= 유명한 축), 입문 난이도가 낮은 순서.
   */
  const targets = WHISKIES.filter((w) => !has.has(w.id) && storyFor(w) && !w.limited)
    .sort((a, b) => a.difficulty - b.difficulty || a.priceKrw[0] - b.priceKrw[0])
    .slice(0, 12)
    .map((w) => ({ id: w.id, label: `${w.nameKo} (${w.name})` }));

  const whiskies = WHISKIES.map((w) => ({
    id: w.id,
    label: `${w.nameKo} (${w.name})`,
    query: w.name,
  }));

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" render={<Link href="/admin/photos" />}>
        <ArrowLeft className="size-4" aria-hidden />
        병 사진 확인
      </Button>

      <div>
        <h2 className="text-xl text-amber-100">커먼즈에서 사진 찾기</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          위키미디어 커먼즈에 올라온 <strong>자유 라이선스</strong> 사진을 병에 붙여요. 사용자가
          찍어 올린 사진이 아직 없는 병에 실물 사진을 채우는 용도예요.
        </p>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <div className="space-y-1 text-amber-50/85">
          <p>
            판매 사이트 제품 이미지는 수입사·유통사 자산이라 쓸 수 없어요. 커먼즈 사진은{" "}
            <strong>출처·촬영자·라이선스를 밝히면</strong> 쓸 수 있고, 붙이면 그 표기가 위스키
            화면에 자동으로 같이 나와요.
          </p>
          <p>
            자유 라이선스가 아닌 사진(NC·ND 포함)은 아예 고를 수 없게 막아뒀어요. 다만{" "}
            <strong>이 병이 맞는지는 사람이 봐야 해요</strong> — 검색은 이름만 맞으면 걸리거든요.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg text-amber-100">여러 병 한 번에</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            사진이 아직 없는 병 중 사람들이 많이 열어보는 것부터 12개씩 찾아와요. 맞는 사진만
            체크해서 한꺼번에 붙이면 돼요. 다 붙이면 다음 12개가 나와요.
          </p>
        </div>
        {targets.length === 0 ? (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">
            채울 병이 없어요. 유명한 병에는 사진이 다 붙어 있어요.
          </p>
        ) : (
          <BatchFinder targets={targets} />
        )}
      </section>

      <section className="space-y-3 border-t pt-5">
        <div>
          <h3 className="text-lg text-amber-100">한 병만 골라서</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            특정 병에 다른 사진을 붙이고 싶을 때 써요.
          </p>
        </div>
        <CommonsFinder whiskies={whiskies} />
      </section>
    </div>
  );
}
