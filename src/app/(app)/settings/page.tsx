import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { NicknameForm } from "./settings-form";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const nickname = profile?.display_name ?? user.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-amber-100">설정</h1>
        <p className="mt-2 text-sm text-muted-foreground">이름을 바꾸거나 계정을 확인할 수 있어요.</p>
      </header>

      <Card>
        <CardContent className="p-5">
          <NicknameForm initial={nickname} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">로그인 계정</p>
            <p className="mt-0.5 text-sm text-amber-50/90">{user.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              로그아웃
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
