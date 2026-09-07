import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { personaFromRow, PERSONA_COLUMNS } from "@/lib/ai/persona";
import { createClient } from "@/lib/supabase/server";
import { hasProfile } from "@/lib/whisky/recommend";
import { AXIS_LABELS_KO, TASTE_AXES, type TasteProfile } from "@/lib/whisky/types";
import { NicknameForm, PersonaForm } from "./settings-form";

export const metadata: Metadata = { title: "내 정보" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  // 내 정보 칸이 아직 DB에 없을 수도 있어요 (schema.sql 을 안 돌린 경우).
  // 그때는 닉네임만 읽어와서 화면이 죽지 않게 해요.
  let row: Record<string, unknown> | null = null;
  const full = await supabase
    .from("profiles")
    .select(`display_name, taste_profile, ${PERSONA_COLUMNS}`)
    .eq("id", user.id)
    .maybeSingle();
  if (full.error) {
    const basic = await supabase
      .from("profiles")
      .select("display_name, taste_profile")
      .eq("id", user.id)
      .maybeSingle();
    row = (basic.data as Record<string, unknown> | null) ?? null;
  } else {
    row = (full.data as Record<string, unknown> | null) ?? null;
  }

  const nickname =
    (typeof row?.display_name === "string" ? row.display_name : "") ||
    user.email?.split("@")[0] ||
    "";
  const persona = personaFromRow(row);
  const stored = (row?.taste_profile as Partial<TasteProfile> | null) ?? null;
  const taste = hasProfile(stored) ? stored : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-amber-100">내 정보</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          여기 적은 내용은 추천과 AI 소믈리에가 참고해요. 전부 선택이고, 언제든 바꿀 수 있어요.
        </p>
      </header>

      <Card>
        <CardContent className="p-5">
          <NicknameForm initial={nickname} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <PersonaForm initial={persona} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-lg text-amber-100">내 취향 축</h2>
          {taste ? (
            <>
              <ul className="space-y-1.5 text-sm">
                {TASTE_AXES.map((axis) => {
                  const value = taste[axis] ?? 0;
                  const pct = ((value + 2) / 4) * 100;
                  return (
                    <li key={axis} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-muted-foreground">{AXIS_LABELS_KO[axis]}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-500/10">
                        <span
                          className="block h-full rounded-full bg-amber-400/70"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right tabular-nums text-amber-200">
                        {value > 0 ? `+${value}` : value}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                취향 진단과 테이스팅 노트로 계속 다듬어져요. 다시 진단하면 새로 계산돼요.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              아직 취향 진단을 안 하셨어요. 질문 12개에 답하면 취향 축이 만들어져요.
            </p>
          )}
          <Button size="sm" variant="outline" render={<Link href="/quiz" />}>
            <Compass className="size-4" aria-hidden /> {taste ? "취향 다시 진단하기" : "취향 진단 시작"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <p className="text-amber-50/85">
          추천은 <strong>취향 진단 답변과 테이스팅 노트</strong>로 계산해요. 나이대는 도수·가격 감각의
          참고로만 쓰고, <strong>성별은 추천에 쓰지 않아요</strong> — 성별로 취향을 나누면 추천이 오히려
          나빠지거든요.
        </p>
      </div>

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
