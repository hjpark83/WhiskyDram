import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };

/**
 * 앱 전체의 404. 헤더가 없는 상태로 떠요 — 로그인 안 한 사람도 이 화면을
 * 보기 때문에, 로그인이 필요한 헤더 메뉴를 띄우면 눌러도 튕기기만 해요.
 * (로그인 영역 안에서 난 404 는 `(app)/not-found.tsx` 가 헤더를 유지해요.)
 */
export default function NotFound() {
  return <NotFoundView />;
}
