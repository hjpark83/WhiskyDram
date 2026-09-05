import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/admin";

const TABS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/popups", label: "팝업 관리" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-amber-300">
          <ShieldCheck className="size-5" aria-hidden />
          <h1 className="text-2xl text-amber-100">관리자</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {admin.email} 계정으로 관리 중이에요.
        </p>
        <nav className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Button key={t.href} variant="outline" size="sm" render={<Link href={t.href} />}>
              {t.label}
            </Button>
          ))}
        </nav>
        <div className="brass-line" />
      </header>
      {children}
    </div>
  );
}
