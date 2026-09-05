import type { Metadata } from "next";
import { Info } from "lucide-react";
import { listPopups } from "@/lib/popup/store";
import { PopupExplorer } from "./popup-explorer";

export const metadata: Metadata = { title: "위스키 팝업 스토어" };

export default async function PopupListPage() {
  const popups = await listPopups();
  const allSample = popups.every((p) => p.source === "seed");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-amber-100 sm:text-4xl">위스키 팝업 스토어</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          브랜드가 여는 팝업은 위스키를 병째로 사지 않고 한 잔씩 맛볼 수 있는 가장 싼 방법이에요.
          지금 열린 곳과 곧 열릴 곳을 모아 두고, 예약·상세 정보는 캐치테이블·네이버로 바로 이어줘요.
        </p>
      </header>

      {allSample && (
        <div className="flex gap-2.5 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-amber-50/85">
            아직 등록된 팝업이 없어서 <strong className="font-semibold">예시 데이터</strong>를 보여주고 있어요.
            실제 기간·장소는 각 카드의 네이버·인스타그램 링크에서 확인해주세요. 관리자가{" "}
            <span className="text-amber-300">관리자 → 팝업 관리</span>에서 등록하면 이 자리에 실제 정보가 나와요.
          </p>
        </div>
      )}

      <PopupExplorer popups={popups} />
    </div>
  );
}
