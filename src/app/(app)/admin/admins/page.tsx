import type { Metadata } from "next";
import { Info, ShieldCheck, ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminUser } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { addAdminEmail, removeAdminEmail } from "../actions";

export const metadata: Metadata = { title: "관리자 명단" };

export default async function AdminAdminsPage() {
  const me = await getAdminUser();
  const supabase = await createClient();

  const [{ data: emails, error: emailError }, { data: admins }] = await Promise.all([
    supabase.from("admin_emails").select("email, note, created_at").order("created_at"),
    supabase.from("admins").select("user_id, granted_at").order("granted_at"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl text-amber-100">관리자 명단</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          여기 적힌 이메일로 <strong>가입하면</strong> 자동으로 관리자가 돼요. 이미 가입한 계정은 아래
          &ldquo;지금 바로 올리기&rdquo;를 눌러야 적용돼요.
        </p>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <p className="text-amber-50/85">
          구글로 로그인하면 <strong>가입할 때 쓴 이메일과 다른 계정</strong>이 될 수 있어요. 관리자 권한이
          안 붙으면 <code className="text-amber-300">/api/health</code> 의 <code className="text-amber-300">you</code> 에서
          지금 로그인한 이메일을 확인해보세요.
        </p>
      </div>

      {emailError ? (
        <Card>
          <CardContent className="p-5 text-sm text-red-200">
            명단을 읽지 못했어요 ({emailError.code ?? "?"}). supabase/schema.sql 을 최신으로 한 번 더
            실행해주세요 — 관리자가 명단을 읽는 정책이 이번에 추가됐어요.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-amber-100">
                <ShieldPlus className="size-4 text-amber-400" aria-hidden />
                <h3 className="text-lg">관리자 추가</h3>
              </div>
              <form action={addAdminEmail} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input id="email" name="email" type="email" placeholder="name@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">메모 (선택)</Label>
                  <Input id="note" name="note" placeholder="예: 공동 운영자" maxLength={60} />
                </div>
                <Button type="submit" size="sm">
                  명단에 추가하고 지금 바로 올리기
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                이미 가입한 계정이면 그 자리에서 관리자가 되고, 아직 가입 전이면 가입하는 순간 적용돼요.
              </p>
            </CardContent>
          </Card>

          <section className="space-y-2">
            <h3 className="text-lg text-amber-100">명단 ({emails?.length ?? 0}명)</h3>
            <ul className="space-y-1.5">
              {(emails ?? []).map((e) => (
                <li
                  key={e.email}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-amber-50">{e.email}</span>
                    {e.note && <span className="block truncate text-xs text-muted-foreground">{e.note}</span>}
                  </span>
                  {/* 자기 자신은 못 지워요 — 관리자가 0명이 되면 아무도 못 들어가요 */}
                  {e.email.toLowerCase() !== (me?.email ?? "").toLowerCase() && (
                    <form action={removeAdminEmail}>
                      <input type="hidden" name="email" value={e.email} />
                      <Button type="submit" size="sm" variant="ghost" className="text-red-300">
                        명단에서 빼기
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            지금 관리자 권한이 붙어 있는 계정: {admins?.length ?? 0}명
          </p>
        </>
      )}
    </div>
  );
}
