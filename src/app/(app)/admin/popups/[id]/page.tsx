import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPopup } from "@/lib/popup/store";
import { PopupForm } from "../popup-form";

export async function generateMetadata({ params }: PageProps<"/admin/popups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const popup = await getPopup(id, { includeUnpublished: true });
  return { title: popup ? `${popup.title} 수정` : "팝업 수정" };
}

export default async function EditPopupPage({ params }: PageProps<"/admin/popups/[id]">) {
  const { id } = await params;
  const popup = await getPopup(id, { includeUnpublished: true });
  if (!popup) notFound();

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-amber-100">{popup.title} 수정</h2>
      <PopupForm initial={popup} />
    </div>
  );
}
