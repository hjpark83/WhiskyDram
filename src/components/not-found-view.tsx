import Link from "next/link";
import { Compass, Home, PenLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 없는 주소로 들어온 사람에게 보여줄 화면.
 *
 * ## 왜 만들었나
 *
 * 기본 404 는 흰 배경에 "This page could not be found." 한 줄이에요. 어두운
 * 테마의 앱에서 그 화면이 뜨면 **사이트가 깨진 것처럼** 보여요. 주소를 잘못
 * 눌러본 사람이 그걸 보고 나가버리면 손해죠.
 *
 * ## 링크를 고른 기준
 *
 * **로그인 안 한 사람도 누를 수 있는 곳**을 먼저 둬요. 404 는 남이 보낸 링크나
 * 오타로 들어오는 자리라 로그인 상태를 가정할 수 없어요. 랜딩과 위스키
 * 이야기는 로그인 없이 열리고, 진단·탐색은 `?next=` 를 붙여서 로그인 뒤
 * 원래 가려던 곳으로 이어지게 해요 (로그인했으면 그냥 통과해요).
 */
export function NotFoundView({ inApp = false }: { inApp?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-amber-400">404</p>
      <div className="brass-line my-4 max-w-24" />
      <h1 className="text-3xl leading-tight text-amber-100 sm:text-4xl">
        찾으시는 잔이 비어 있어요
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        이 주소에는 아무것도 없어요. 주소를 잘못 누르셨거나, 사라진 페이지일 수 있어요.
        아래에서 다시 시작해보세요.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {/* 로그인 없이 열리는 곳을 먼저 */}
        <Button render={<Link href={inApp ? "/home" : "/"} />}>
          <Home className="size-4" aria-hidden />
          {inApp ? "홈으로" : "처음으로"}
        </Button>
        <Button variant="outline" render={<Link href="/quiz" />}>
          <Compass className="size-4" aria-hidden />
          취향 진단하기
        </Button>
        <Button variant="outline" render={<Link href="/whisky" />}>
          <Search className="size-4" aria-hidden />
          위스키 탐색
        </Button>
        <Button variant="ghost" render={<Link href="/posts" />}>
          <PenLine className="size-4" aria-hidden />
          위스키 이야기
        </Button>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        위스키 이름으로 찾으시는 거라면{" "}
        <Link href="/whisky" className="text-amber-300 hover:underline">
          위스키 탐색
        </Link>
        에서 504병을 이름·나라·가격으로 걸러볼 수 있어요.
      </p>
    </main>
  );
}
