"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  attachCommonsPhoto,
  searchCommonsPhotos,
  type AttachState,
  type CommonsSearchState,
} from "../../actions";

export interface WhiskyOption {
  id: string;
  label: string;
  /** 커먼즈는 영문 이름으로 찾아야 걸려요 */
  query: string;
}

export function CommonsFinder({ whiskies }: { whiskies: WhiskyOption[] }) {
  const [search, searchAction, searching] = useActionState<CommonsSearchState, FormData>(
    searchCommonsPhotos,
    null,
  );
  const [attach, attachAction, attaching] = useActionState<AttachState, FormData>(
    attachCommonsPhoto,
    null,
  );

  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<WhiskyOption | null>(null);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return whiskies.filter((w) => w.label.toLowerCase().includes(term)).slice(0, 8);
  }, [whiskies, q]);

  const found = search && "photos" in search ? search.photos : [];

  return (
    <div className="space-y-5">
      {/* 1. 어떤 병에 붙일지 */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <Label>1. 사진을 붙일 위스키</Label>
          {picked ? (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{picked.label}</span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="shrink-0 text-xs text-muted-foreground hover:text-amber-300"
              >
                바꾸기
              </button>
            </div>
          ) : (
            <>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이름으로 검색 (예: 라가불린, Macallan)"
              />
              {matches.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {matches.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(w)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-amber-500/10"
                      >
                        {w.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. 커먼즈에서 찾기 */}
      {picked && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <form action={searchAction} className="space-y-3">
              <input type="hidden" name="whiskyId" value={picked.id} />
              <Label htmlFor="commons-q">2. 커먼즈에서 찾을 검색어</Label>
              <p className="text-xs text-muted-foreground">
                커먼즈에는 한글 이름이 거의 없어서 영문으로 찾아요. 비워두면 영문 제품명으로 찾아요.
              </p>
              <div className="flex gap-2">
                <Input
                  id="commons-q"
                  name="query"
                  defaultValue={picked.query}
                  placeholder={picked.query}
                />
                <Button type="submit" disabled={searching}>
                  {searching ? "찾는 중…" : "찾기"}
                </Button>
              </div>
            </form>
            {search && "error" in search && (
              <p className="text-sm text-destructive" role="alert">
                {search.error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {attach?.error && (
        <p className="text-sm text-destructive" role="alert">
          {attach.error}
        </p>
      )}
      {attach?.message && (
        <p className="text-sm text-amber-300" role="status">
          {attach.message}
        </p>
      )}

      {/* 3. 고르기 */}
      {found.length > 0 && picked && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg text-amber-100">3. 사진 고르기 ({found.length}장)</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              <strong>이 병이 맞는지 꼭 눈으로 확인해주세요.</strong> 이름만 맞으면 다른 병이나
              잔·증류소 건물 사진도 걸려요. 자유 라이선스가 아닌 사진은 고를 수 없게 막아뒀어요.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {found.map((photo) => (
              <li key={photo.title}>
                <Card className="overflow-hidden">
                  <div className="relative aspect-square bg-black/30">
                    <Image
                      src={photo.thumbUrl}
                      alt={photo.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 320px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <CardContent className="space-y-2 p-3 text-xs">
                    <p className="truncate text-muted-foreground">
                      {photo.title.replace(/^File:/, "")}
                    </p>
                    <p className="text-muted-foreground">
                      촬영 {photo.credit} · <span className="text-amber-200">{photo.license}</span>
                    </p>
                    <a
                      href={photo.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-amber-300 hover:underline"
                    >
                      커먼즈에서 원본 보기
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                    {photo.usable ? (
                      <form action={attachAction}>
                        <input type="hidden" name="whiskyId" value={picked.id} />
                        <input type="hidden" name="imageUrl" value={photo.imageUrl} />
                        <input type="hidden" name="sourceUrl" value={photo.sourceUrl} />
                        <input type="hidden" name="credit" value={photo.credit} />
                        <input type="hidden" name="license" value={photo.license} />
                        <Button type="submit" size="sm" className="w-full" disabled={attaching}>
                          이 사진 붙이기
                        </Button>
                      </form>
                    ) : (
                      <p className="rounded-md border border-destructive/40 p-2 text-destructive">
                        자유 라이선스가 아니라 쓸 수 없어요.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
