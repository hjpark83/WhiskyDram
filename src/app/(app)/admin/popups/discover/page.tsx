import type { Metadata } from "next";
import { activeProvider } from "@/lib/ai/provider";
import { suggestedBrands } from "@/lib/ai/popup-research";
import { DiscoverView } from "./discover-view";

export const metadata: Metadata = { title: "AI로 팝업 찾기" };

export default function DiscoverPopupsPage() {
  const provider = activeProvider();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl text-amber-100">AI로 팝업 찾기</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          AI가 웹을 검색해서 위스키 브랜드 팝업을 찾아 정리해줘요. 캐치테이블·네이버 페이지를 긁는 게
          아니라 검색 결과를 근거로 삼기 때문에, 나온 내용은 <strong>초안</strong>이에요. 출처를 확인하고
          공개해주세요.
        </p>
      </div>

      {!provider ? (
        <p className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-4 text-sm text-amber-50/85">
          AI 키가 없어서 검색을 할 수 없어요. Vercel 환경변수에 <code className="text-amber-300">GEMINI_API_KEY</code>{" "}
          같은 키를 넣고 다시 열어주세요.
        </p>
      ) : (
        <DiscoverView suggestedBrands={suggestedBrands()} providerLabel={provider.label} />
      )}
    </div>
  );
}
