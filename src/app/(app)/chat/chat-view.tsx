"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MatchBadge } from "@/components/whisky/whisky-card";
import { cn } from "@/lib/utils";
import { STYLE_EMOJI, STYLE_LABELS_KO } from "@/lib/whisky/format";
import type { ChatEvent, ChatWhiskySummary } from "@/lib/ai/chat";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  whiskies: ChatWhiskySummary[];
  status?: string | null; // 도구 실행 중 표시
  error?: string | null;
}

const SUGGESTIONS = [
  "삼겹살이랑 같이 마실 5만 원대 위스키 추천해줘",
  "연기 향 처음 도전해보고 싶어. 순한 것부터",
  "선물용으로 10만 원 안쪽, 병이 예쁜 걸로",
  "하이볼 만들기 좋은 저렴한 병은?",
  "셰리 위스키가 뭐야? 입문용 하나만",
];

function renderInline(text: string) {
  // **굵게** 만 지원 (마크다운 전체 렌더러는 과해요)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function ChatView({ personalized, greeting }: { personalized: boolean; greeting: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: "hello", role: "assistant", content: greeting, whiskies: [] },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: UiMessage = { id: crypto.randomUUID(), role: "user", content: q, whiskies: [] };
    const botId = crypto.randomUUID();
    const history = [...messages.filter((m) => m.id !== "hello"), userMsg];
    setMessages([...messages, userMsg, { id: botId, role: "assistant", content: "", whiskies: [], status: "생각하는 중…" }]);

    const patch = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? fn(m) : m)));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text().catch(() => "")) || "요청에 실패했어요.";
        patch((m) => ({ ...m, status: null, error: msg }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as ChatEvent;
          if (ev.type === "text") {
            patch((m) => ({ ...m, content: m.content + ev.text, status: null }));
          } else if (ev.type === "tool") {
            patch((m) => ({ ...m, status: ev.label }));
          } else if (ev.type === "whiskies") {
            patch((m) => {
              const seen = new Set(m.whiskies.map((w) => w.id));
              return { ...m, whiskies: [...m.whiskies, ...ev.items.filter((w) => !seen.has(w.id))] };
            });
          } else if (ev.type === "error") {
            patch((m) => ({ ...m, status: null, error: ev.message }));
          } else if (ev.type === "done") {
            patch((m) => ({ ...m, status: null }));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        patch((m) => ({ ...m, status: null, error: "연결이 끊겼어요. 다시 시도해주세요." }));
      }
    } finally {
      patch((m) => ({ ...m, status: null }));
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[480px] flex-col rounded-2xl border bg-card">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                m.role === "user" ? "bg-muted" : "bg-amber-500 text-amber-950",
              )}
            >
              {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
            </div>
            <div className={cn("max-w-[85%] space-y-2", m.role === "user" && "text-right")}>
              {(m.content || m.status || m.error) && (
                <div
                  className={cn(
                    "inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
                    m.role === "user" ? "bg-amber-500 text-amber-950" : "bg-muted",
                  )}
                >
                  {m.content && renderInline(m.content)}
                  {m.status && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Sparkles className="size-3.5 animate-pulse text-amber-400" aria-hidden />
                      {m.status}
                    </span>
                  )}
                  {m.error && <span className="text-destructive">{m.error}</span>}
                </div>
              )}
              {m.whiskies.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {m.whiskies.slice(0, 6).map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/whisky/${w.id}`}
                        className="block rounded-xl border bg-background px-3 py-2 text-left transition-colors hover:border-amber-400/60"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{w.nameKo}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {w.origin} {w.typeLabel} · {w.abv}% · {w.price}
                            </p>
                          </div>
                          <MatchBadge percent={w.percent} />
                        </div>
                        {w.styles.length > 0 && (
                          <p className="mt-1 text-xs text-amber-300">
                            {w.styles.map((t) => `${STYLE_EMOJI[t]} ${STYLE_LABELS_KO[t]}`).join("  ")}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 sm:p-4">
        {messages.length <= 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border px-3 py-1 text-xs hover:border-amber-400/60"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={
              personalized
                ? "예: 오늘 치킨 시켰는데 뭐가 어울릴까?"
                : "예: 위스키 처음인데 뭐부터 마셔볼까?"
            }
            className="min-h-10 resize-none"
            disabled={busy}
          />
          <Button type="submit" size="icon-lg" disabled={busy || !input.trim()} aria-label="보내기">
            <Send />
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">
          사전에 있는 312병 안에서만 추천해요. 대화는 저장되지 않아요.
        </p>
      </div>
    </div>
  );
}
