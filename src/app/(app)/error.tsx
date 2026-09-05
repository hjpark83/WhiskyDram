"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 로그인 영역에서 서버 오류가 났을 때 흰 화면 대신 보여줄 안내.
 * digest 는 Vercel 런타임 로그에서 같은 값을 찾아 원인을 볼 수 있는 열쇠예요.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] 렌더링 실패", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
      <TriangleAlert className="mx-auto size-8 text-amber-400" aria-hidden />
      <h1 className="text-2xl text-amber-100">잠시 문제가 생겼어요</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        화면을 그리는 중에 오류가 났어요. 다시 시도해보시고, 계속 이러면 아래 코드를 알려주세요.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">오류 코드: {error.digest}</p>
      )}
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>다시 시도</Button>
        <Button variant="outline" render={<Link href="/home" />}>
          홈으로
        </Button>
      </div>
    </div>
  );
}
