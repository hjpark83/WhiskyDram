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

  // 지구본은 헤더 아래 화면 전체를 차지해요 (fixed). 페이지 흐름에는 아무것도 두지 않아요.
  return <GlobeView distilleries={distilleries} personalized={Boolean(profile)} />;
}
