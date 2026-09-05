import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { activeProvider } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/server";
import { hasProfile } from "@/lib/whisky/recommend";
import type { TasteProfile } from "@/lib/whisky/types";
import type { RecommendationPayload } from "@/lib/ai/recommend";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "AI 소믈리에" };

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/chat");

  const [{ data: profileRow }, { data: rec }] = await Promise.all([
    supabase.from("profiles").select("taste_profile, display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("recommendations")
      .select("payload")
      .eq("user_id", user.id)
      .in("source", ["quiz", "review"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const personalized = hasProfile((profileRow?.taste_profile as Partial<TasteProfile> | null) ?? null);
  const title = (rec?.payload as RecommendationPayload | null)?.tasteTitle;

  const greeting = personalized
    ? `안녕하세요! 취향 프로필을 봤어요${title ? ` — "${title}" 타입이시네요` : ""}. 오늘은 어떤 상황이에요? 음식, 예산, 기분 아무거나 말씀해주세요.`
    : "안녕하세요, AI 소믈리에예요. 위스키가 처음이어도 괜찮아요. 어떤 상황인지 편하게 말씀해주세요. 취향 진단을 하시면 더 정확하게 골라드릴 수 있어요.";

  const provider = activeProvider();

  return (
    <div className="space-y-4">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">AI 소믈리에</h1>
          {provider && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {provider.label} · {provider.model}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">
          음식, 예산, 기분을 말하면 사전에서 찾아 골라줘요.
        </p>
      </section>
      <ChatView personalized={personalized} greeting={greeting} />
    </div>
  );
}
