"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PickerOption {
  id: string;
  nameKo: string;
  name: string;
  distillery: string;
  aliases: string[];
}

export function ComparePicker({
  slot,
  options,
  selected,
}: {
  slot: "a" | "b";
  options: PickerOption[];
  selected: PickerOption | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((w) => [w.nameKo, w.name, w.distillery, ...w.aliases].join(" ").toLowerCase().includes(q))
      .slice(0, 6);
  }, [options, query]);

  function setId(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set(slot, id);
    else next.delete(slot);
    router.replace(`/compare?${next.toString()}`);
    setQuery("");
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-amber-400 bg-amber-500/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{selected.nameKo}</p>
          <p className="truncate text-xs text-muted-foreground">{selected.name}</p>
        </div>
        <button
          type="button"
          onClick={() => setId(null)}
          className="rounded-full p-1 text-muted-foreground hover:bg-amber-500/20"
          aria-label="다른 위스키 선택"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={slot === "a" ? "첫 번째 병 검색" : "비교할 병 검색"}
          className="pl-9"
        />
      </div>
      {matches.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {matches.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setId(w.id)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-amber-500/10"
              >
                <span className="font-medium">{w.nameKo}</span>
                <span className="text-xs text-muted-foreground">{w.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
