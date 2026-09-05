"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Camera,
  Compass,
  Globe2,
  Home,
  MessageCircle,
  NotebookPen,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/quiz", label: "취향 진단", icon: Compass },
  { href: "/recommend", label: "내 추천", icon: Sparkles },
  { href: "/chat", label: "AI 소믈리에", icon: MessageCircle },
  { href: "/whisky", label: "위스키 탐색", icon: Search },
  { href: "/scan", label: "병 스캔", icon: Camera },
  { href: "/journal", label: "테이스팅 노트", icon: NotebookPen },
  { href: "/map", label: "증류소 지도", icon: Globe2 },
  { href: "/popup", label: "팝업 스토어", icon: Store },
  { href: "/glossary", label: "용어 사전", icon: BookOpen },
];

/** 모바일 하단 탭에 넣을 5개 */
const MOBILE_TABS = ["/home", "/quiz", "/chat", "/scan", "/whisky"];

export function SiteHeader({
  email,
  displayName,
  isAdmin = false,
}: {
  email: string | null;
  displayName?: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/home" className="brand shrink-0 text-lg font-bold text-amber-300">
            🥃 FirstDram
          </Link>
          <nav className="hidden gap-0.5 overflow-x-auto sm:flex">
            {nav.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                className={cn(isActive(item.href) && "bg-amber-500/10 text-amber-300")}
                render={<Link href={item.href} />}
              >
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-amber-300", isActive("/admin") && "bg-amber-500/10")}
                render={<Link href="/admin" />}
              >
                <ShieldCheck className="size-4" aria-hidden />
                <span className="hidden sm:inline">관리자</span>
              </Button>
            )}
            {(displayName || email) && (
              <Link
                href="/settings"
                title="설정"
                className={cn(
                  "hidden max-w-32 truncate rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-amber-300 lg:inline-block",
                  isActive("/settings") && "text-amber-300",
                )}
              >
                {displayName || email}
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                로그아웃
              </Button>
            </form>
          </div>
        </div>
        <div className="brass-line" />
      </header>

      {/* 모바일 하단 탭바 */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="주요 메뉴"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((href) => {
            const item = nav.find((n) => n.href === href)!;
            const Icon = item.icon;
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                    active ? "text-amber-400" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active && "fill-amber-500/30")} aria-hidden />
                  {item.label.replace("AI ", "").replace("위스키 ", "")}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
