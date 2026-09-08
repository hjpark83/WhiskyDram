import { FEATURES } from "@/data/features";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PopupForm } from "../popup-form";

export const metadata: Metadata = { title: "새 팝업 등록" };

export default function NewPopupPage() {
  // 팝업 스토어는 잠시 꺼둔 기능이에요 (src/data/features.ts)
  if (!FEATURES.popup) notFound();

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-amber-100">새 팝업 등록</h2>
      <PopupForm />
    </div>
  );
}
