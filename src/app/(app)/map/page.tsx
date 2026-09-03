import type { Metadata } from "next";
import { getDistilleries } from "@/data/distilleries";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/whisky/format";
import { hasProfile, matchPercent } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";
import { GlobeView, type GlobeDistillery } from "./globe-view";

export const metadata: Metadata = { title: "증류소 지도" };

export default async function MapPage() {
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

  // 클라이언트로 보낼 때는 필요한 필드만 (사전 전체는 무거워요)
  const distilleries: GlobeDistillery[] = getDistilleries().map((d) => {
    const whiskies = d.whiskies.map((w) => ({
      id: w.id,
      nameKo: w.nameKo,
      name: w.name,
      type: w.type,
      styles: w.styles,
      priceKrw: w.priceKrw,
      difficulty: w.difficulty,
      abv: w.abv,
      percent: profile ? matchPercent(profile, w) : null,
    }));
    const percents = whiskies.map((w) => w.percent).filter((p): p is number => p !== null);
    return {
      name: d.name,
      nameKo: d.meta.nameKo,
      founded: d.meta.founded,
      blurb: d.meta.blurb,
      country: d.country,
      region: d.region,
      origin: getOrigin(d.whiskies[0]),
      lat: d.lat,
      lng: d.lng,
      whiskies,
      bestPercent: percents.length ? Math.max(...percents) : null,
    };
  });

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">증류소 지도</h1>
          <p className="mt-1 text-muted-foreground">
            지구본을 돌려 {distilleries.length}곳의 증류소를 찾아보세요. 점을 누르면 그곳에서 만드는 병이 나와요.
            {profile
              ? " 점 색이 진할수록 내 취향과 잘 맞는 증류소예요."
              : " 취향 진단을 하면 점 색이 내 취향 적합도로 바뀌어요."}
          </p>
        </div>
      </section>
      <GlobeView distilleries={distilleries} personalized={Boolean(profile)} />
    </div>
  );
}
