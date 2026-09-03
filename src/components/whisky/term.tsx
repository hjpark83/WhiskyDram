"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARY_MATCHERS, getGlossaryEntry, type GlossaryEntry } from "@/data/glossary";
import { cn } from "@/lib/utils";

/** 용어 하나에 팝오버를 붙여요. */
export function Term({ entry, children, className }: { entry: GlossaryEntry; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "cursor-help rounded-sm underline decoration-amber-600/60 decoration-dotted underline-offset-4 hover:bg-amber-50 hover:decoration-amber-600",
          className,
        )}
      >
        {children}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1.5 block w-72 max-w-[85vw] rounded-xl border bg-popover p-3 text-left text-xs leading-relaxed text-popover-foreground shadow-lg"
        >
          <span className="mb-1 block font-semibold">
            {entry.emoji} {entry.term}
          </span>
          <span className="block text-muted-foreground">{entry.short}</span>
          <Link href={`/glossary#${entry.id}`} className="mt-2 block text-amber-700 underline">
            더 알아보기
          </Link>
        </span>
      )}
    </span>
  );
}

/** 문장 속 용어를 자동으로 찾아 Term 으로 감싸요. 같은 용어는 문단당 한 번만. */
export function GlossaryText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  const used = new Set<string>();
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    let bestIdx = -1;
    let best: (typeof GLOSSARY_MATCHERS)[number] | null = null;
    for (const m of GLOSSARY_MATCHERS) {
      if (used.has(m.entry.id)) continue;
      const idx = rest.indexOf(m.text);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && m.text.length > (best?.text.length ?? 0)))) {
        bestIdx = idx;
        best = m;
      }
    }
    if (!best || bestIdx === -1) {
      nodes.push(<span key={key++}>{rest}</span>);
      break;
    }
    if (bestIdx > 0) nodes.push(<span key={key++}>{rest.slice(0, bestIdx)}</span>);
    nodes.push(
      <Term key={key++} entry={best.entry}>
        {best.text}
      </Term>,
    );
    used.add(best.entry.id);
    rest = rest.slice(bestIdx + best.text.length);
  }

  return <span className={className}>{nodes}</span>;
}

/** id 로 직접 감싸고 싶을 때 */
export function TermById({ id, children }: { id: string; children: ReactNode }) {
  const entry = getGlossaryEntry(id);
  if (!entry) return <>{children}</>;
  return <Term entry={entry}>{children}</Term>;
}
