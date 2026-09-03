import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasProfile } from "@/lib/whisky/recommend";
import type { TasteProfile } from "@/lib/whisky/types";
import { ScanForm } from "./scan-form";

export const metadata: Metadata = { title: "병 스캔" };

export default async function ScanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/scan");

  const { data } = await supabase
    .from("profiles")
    .select("taste_profile")
    .eq("id", user.id)
    .maybeSingle();
  const personalized = hasProfile((data?.taste_profile as Partial<TasteProfile> | null) ?? null);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">병 스캔</h1>
        <p className="mt-1 text-muted-foreground">
          라벨을 찍으면 어떤 병인지 알려주고, 지금 내 취향에 맞는지 판정해요.
        </p>
      </section>
      <ScanForm personalized={personalized} />
    </div>
  );
}
