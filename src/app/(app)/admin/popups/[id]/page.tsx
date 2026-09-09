import { FEATURES } from "@/data/features";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { activeProvider } from "@/lib/ai/provider";
import { getPopup } from "@/lib/popup/store";
import { PopupForm } from "../popup-form";
import { RecheckPanel } from "../recheck-panel";

export async function generateMetadata({ params }: PageProps<"/admin/popups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const popup = await getPopup(id, { includeUnpublished: true });
  return { title: popup ? `${popup.title} 수정` : "팝업 수정" };
}

export default async function EditPopupPage({ params }: PageProps<"/admin/popups/[id]">) {
  // 팝업 스토어는 잠시 꺼둔 기능이에요 (src/data/features.ts)
  if (!FEATURES.popup) notFound();

  const { id } = await params;
  const popup = await getPopup(id, { includeUnpublished: true });
  if (!popup) notFound();

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-amber-100">{popup.title} 수정</h2>
      {/* 재확인은 DB 에 있는 팝업만 (시드는 코드의 예시라 고칠 행이 없어요) */}
      {popup.source === "db" && (
        <RecheckPanel
          popupId={popup.id}
          pending={popup.pendingRecheck}
          lastCheckedAt={popup.lastCheckedAt}
          aiReady={Boolean(activeProvider())}
        />
      )}
      <PopupForm initial={popup} />
    </div>
  );
}
