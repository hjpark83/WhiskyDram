"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButton({ query, title }: { query: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/share?${query}`;
    const text = `나는 "${title}" 타입! AI가 골라준 내 첫 위스키 3병 🥃`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "FirstDram 취향 결과", text, url });
        return;
      } catch {
        // 취소했거나 지원 안 함 → 복사로
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("링크를 복사했어요. 친구에게 보내보세요!");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했어요. 주소창의 링크를 직접 복사해주세요.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={share}>
      {copied ? <Check data-icon="inline-start" /> : <Share2 data-icon="inline-start" />}
      결과 공유하기
    </Button>
  );
}
