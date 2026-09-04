import { z } from "zod";
import { getWhisky } from "@/data/whiskies";
import { runChat, type ChatContext, type ChatEvent } from "@/lib/ai/chat";
import { createClient } from "@/lib/supabase/server";
import { hasProfile } from "@/lib/whisky/recommend";
import { EMPTY_TASTE_PROFILE, type TasteProfile } from "@/lib/whisky/types";

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("로그인이 필요해요.", { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("잘못된 요청이에요.", { status: 400 });

  const [{ data: profileRow }, { data: notes }] = await Promise.all([
    supabase.from("profiles").select("taste_profile").eq("id", user.id).maybeSingle(),
    supabase
      .from("tasting_notes")
      .select("whisky_id, rating, review")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const stored = (profileRow?.taste_profile as Partial<TasteProfile> | null) ?? null;
  const ctx: ChatContext = {
    profile: hasProfile(stored) ? { ...EMPTY_TASTE_PROFILE, ...stored } : null,
    recentNotes: (notes ?? []).map((n) => ({
      whiskyNameKo: getWhisky(n.whisky_id)?.nameKo ?? n.whisky_id,
      rating: n.rating ?? 3,
      review: n.review,
    })),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const event of runChat(parsed.data.messages, ctx)) send(event);
      } catch (error) {
        console.error("[api/chat]", error);
        send({ type: "error", message: "문제가 생겼어요. 다시 시도해주세요." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
