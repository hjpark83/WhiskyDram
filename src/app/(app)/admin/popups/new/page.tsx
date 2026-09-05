import type { Metadata } from "next";
import { PopupForm } from "../popup-form";

export const metadata: Metadata = { title: "새 팝업 등록" };

export default function NewPopupPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl text-amber-100">새 팝업 등록</h2>
      <PopupForm />
    </div>
  );
}
