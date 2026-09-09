import { FEATURES } from "@/data/features";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { listPopups } from "@/lib/popup/store";
import { PopupExplorer } from "./popup-explorer";

export const metadata: Metadata = { title: "위스키 팝업 스토어" };

export default async function PopupListPage() {
  // 팝업 스토어는 잠시 꺼둔 기능이에요 (src/data/features.ts)
  if (!FEATURES.popup) notFound();

  const popups = await listPopups();
  const allSample = popups.every((p) => p.source === "seed");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-amber-100 sm:text-4xl">위스키 팝업 스토어</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          브랜드가 여는 팝업은 위스키를 병째로 사지 않고 한 잔씩 맛볼 수 있는 가장 싼 방법이에요.
          기간·장소·입장료·프로그램을 흩어진 곳에서 모아 여기에 정리해둬요. 검색 결과를 다시
          헤매지 않아도 되고, 각 팝업에 출처와 확인 날짜를 같이 적어둬서 언제 정보인지도 알 수 있어요.
        </p>
      </header>

      {allSample && (
        <div className="flex gap-2.5 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-amber-50/85">
            아직 등록된 팝업이 없어서 <strong className="font-semibold">예시 데이터</strong>를 보여주고 있어요.
            기간·장소가 실제 발표된 정보가 아니니 이것만은 링크에서 직접 확인해주세요. 관리자가{" "}
            <span className="text-amber-300">관리자 → 팝업 관리 → AI로 팝업 찾기</span>를 돌리면 이 자리에
            출처가 붙은 실제 정보가 들어와요.
          </p>
        </div>
      )}

      <PopupExplorer popups={popups} />
    </div>
  );
}
