import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };

/**
 * 로그인 영역 안에서 난 404 (없는 위스키 id, 없는 팝업 id 등).
 *
 * 루트 404 와 따로 두는 이유: 이 파일이 있으면 `(app)/layout.tsx` 안에서
 * 렌더돼서 **헤더가 그대로 남아요.** 로그인해서 쓰던 사람이 오타 한 번에
 * 메뉴까지 사라진 화면을 보면 앱이 죽은 것처럼 느껴져요.
 */
export default function AppNotFound() {
  return <NotFoundView inApp />;
}
