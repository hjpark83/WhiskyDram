import Link from "next/link";
import { Button } from "@/components/ui/button";

// 아직 안 만든 페이지는 넣지 않아요 (데모에서 404 방지). 만들 때마다 추가.
const nav = [
  { href: "/home", label: "홈" },
  { href: "/quiz", label: "취향 진단" },
  { href: "/recommend", label: "내 추천" },
  { href: "/whisky", label: "위스키 탐색" },
  { href: "/journal", label: "테이스팅 노트" },
];

export function SiteHeader({ email }: { email: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/home" className="shrink-0 font-bold">
          🥃 FirstDram
        </Link>
        <nav className="flex gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              render={<Link href={item.href} />}
            >
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {email && (
            <span className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline">
              {email}
            </span>
          )}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
