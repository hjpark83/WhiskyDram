import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WHISKIES } from "@/data/whiskies";
import { createClient } from "@/lib/supabase/server";
import { hasProfile } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";
import { WhiskyExplorer } from "./whisky-explorer";

export const metadata: Metadata = { title: "위스키 탐색" };

export default async function WhiskyListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: TasteProfile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("taste_profile")
      .eq("id", user.id)
      .maybeSingle();
    const stored = (data?.taste_profile as Partial<TasteProfile> | null) ?? null;
    if (hasProfile(stored)) profile = { ...EMPTY_TASTE_PROFILE, ...stored };
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">위스키 탐색</h1>
          <p className="mt-1 text-muted-foreground">
            국내에서 구할 수 있는 {WHISKIES.length}병을 쉬운 말로 정리했어요.
            {profile
              ? " 카드의 퍼센트는 내 취향과 얼마나 맞는지예요."
              : " 취향 진단을 하면 나와 맞는 정도를 함께 보여드려요."}
          </p>
        </div>
        {!profile && (
          <Button size="sm" render={<Link href="/quiz" />}>
            1분 취향 진단
          </Button>
        )}
      </section>
      <WhiskyExplorer whiskies={WHISKIES} profile={profile} />
    </div>
  );
}
