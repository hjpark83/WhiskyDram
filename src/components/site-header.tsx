"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Camera,
  Compass,
  Globe2,
  Home,
  MessageCircle,
  NotebookPen,
  Search,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Sparkles,
  PenLine,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

/**
 * 메뉴가 10개라 좁은 화면에서는 긴 이름이 다 안 들어가요.
 * 그래서 `short` 를 기본으로 보여주고, 넓은 화면(xl)에서만 `label` 을 보여줘요.
 */
const nav = [
  // 팝업 스토어는 FEATURES.popup 으로 꺼둔 상태예요 (src/data/features.ts)
  { href: "/home", label: "홈", short: "홈", icon: Home },
  { href: "/quiz", label: "취향 진단", short: "진단", icon: Compass },
  { href: "/recommend", label: "내 추천", short: "추천", icon: Sparkles },
  { href: "/chat", label: "AI 소믈리에", short: "소믈리에", icon: MessageCircle },
  { href: "/whisky", label: "위스키 탐색", short: "탐색", icon: Search },
  { href: "/scan", label: "병 스캔", short: "스캔", icon: Camera },
  { href: "/journal", label: "테이스팅 노트", short: "노트", icon: NotebookPen },
  { href: "/map", label: "증류소 지도", short: "지도", icon: Globe2 },
  { href: "/posts", label: "위스키 이야기", short: "이야기", icon: PenLine },
  { href: "/price", label: "위스키 시세", short: "시세", icon: Tag },
  { href: "/glossary", label: "용어 사전", short: "용어", icon: BookOpen },
];

/**
 * 모바일 하단 탭에 넣을 4개. 다섯 번째 칸은 "더보기" 예요.
 *
 * 예전엔 5개를 넣었는데, 메뉴가 12개라 **나머지 7개는 모바일에서 아예 갈 수가
 * 없었어요.** (지도·시세·이야기·노트·용어…) 넷만 고정하고 나머지는 더보기로 빼요.
 */
const MOBILE_TABS = ["/home", "/quiz", "/scan", "/whisky"];

export function SiteHeader({
  email,
  displayName,
  isAdmin = false,
  signedIn = true,
}: {
  email: string | null;
  displayName?: string | null;
  isAdmin?: boolean;
  /**
   * 로그인 안 한 사람도 위스키 이야기는 읽을 수 있어요. 그때 나머지 메뉴를
   * 그대로 보여주면 눌러도 로그인 화면으로 튕겨서, 읽을 수 있는 것만 남겨요.
   */
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const items = signedIn ? nav : nav.filter((item) => item.href === "/posts");
  /** 하단 탭에 자리가 없어 "더보기" 로 가는 나머지 메뉴 */
  const moreItems = nav.filter((item) => !MOBILE_TABS.includes(item.href));


  return (
    <>
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link href={signedIn ? "/home" : "/"} className="brand shrink-0 text-lg font-bold text-amber-300">
            <BrandMark />
          </Link>
          <nav className="no-scrollbar hidden min-w-0 gap-0.5 overflow-x-auto sm:flex">
            {items.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                className={cn(isActive(item.href) && "bg-amber-500/10 text-amber-300")}
                render={<Link href={item.href} title={item.label} />}
              >
                <span className="xl:hidden">{item.short}</span>
                <span className="hidden xl:inline">{item.label}</span>
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
            {signedIn ? (
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="outline" size="sm">
                  로그아웃
                </Button>
              </form>
            ) : (
              <Button size="sm" render={<Link href="/login" />}>
                로그인
              </Button>
            )}
          </div>
        </div>
        <div className="brass-line" />
      </header>

      {/* 모바일 하단 탭바 — 전부 로그인이 필요한 화면이라 로그인했을 때만 */}
      {signedIn && (
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
                  {item.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 py-2 text-[11px]",
                moreOpen || moreItems.some((i) => isActive(i.href))
                  ? "text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              더보기
            </button>
          </li>
        </ul>
      </nav>
      )}

      {/* 더보기 — 하단 탭에 자리가 없는 나머지 메뉴 */}
      {signedIn && moreOpen && (
        <>
          <button
            type="button"
            aria-label="더보기 닫기"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background p-3 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:hidden"
          >
            <p className="px-2 pb-2 text-xs text-muted-foreground">메뉴</p>
            <ul className="grid grid-cols-3 gap-1">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px]",
                        active ? "bg-amber-500/10 text-amber-300" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {item.short}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/settings"
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px]",
                    isActive("/settings") ? "bg-amber-500/10 text-amber-300" : "text-muted-foreground",
                  )}
                >
                  <Settings className="size-5" aria-hidden />
                  내 정보
                </Link>
              </li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
