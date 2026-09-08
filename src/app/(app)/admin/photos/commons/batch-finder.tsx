"use client";

import { useActionState } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  attachCommonsBatch,
  findCommonsBatch,
  type AttachState,
  type BatchState,
} from "../../actions";

export interface BatchTarget {
  id: string;
  label: string;
}

/**
 * 여러 병을 한 번에 채우기.
 *
 * 504병을 한 병씩 붙이는 건 현실적으로 못 해요. 사진이 없는 병을 모아 한 번에
 * 찾아보고, 쓸 만한 후보에 체크해서 한꺼번에 붙여요.
 *
 * 그래도 **고르는 건 사람**이에요. 커먼즈 검색은 이름만 맞으면 다른 병이나
 * 잔·증류소 건물도 물어와서, 자동으로 붙이면 틀린 사진이 섞여요.
 */
export function BatchFinder({ targets }: { targets: BatchTarget[] }) {
  const [found, findAction, finding] = useActionState<BatchState, FormData>(
    findCommonsBatch,
    null,
  );
  const [attached, attachAction, attaching] = useActionState<AttachState, FormData>(
    attachCommonsBatch,
    null,
  );

  const candidates = found && "candidates" in found ? found.candidates : [];
  const withPhoto = candidates.filter((c) => c.photo);

  return (
    <div className="space-y-4">
      <form action={findAction}>
        <input type="hidden" name="whiskyIds" value={targets.map((t) => t.id).join(",")} />
        <Button type="submit" disabled={finding || targets.length === 0}>
          {finding
            ? "커먼즈에서 찾는 중…"
            : `사진 없는 ${targets.length}병 한 번에 찾기`}
        </Button>
      </form>

      {found && "error" in found && (
        <p className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive" role="alert">
          {found.error}
        </p>
      )}
      {attached?.error && (
        <p className="text-sm text-destructive" role="alert">
          {attached.error}
        </p>
      )}
      {attached?.message && (
        <p className="text-sm text-amber-300" role="status">
          {attached.message} 위스키 화면에 바로 보여요.
        </p>
      )}

      {candidates.length > 0 && (
        <form action={attachAction} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              후보를 찾은 병 {withPhoto.length}개 / {candidates.length}개.{" "}
              <strong className="text-amber-200">이 병이 맞는지 눈으로 확인하고</strong> 체크해주세요.
            </p>
            <div className="flex items-center gap-2">
              {/* 하나씩 누르지 않아도 되게. 그래도 눈으로는 훑어봐주세요. */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => {
                  const form = e.currentTarget.closest("form");
                  if (!form) return;
                  const boxes = form.querySelectorAll<HTMLInputElement>('input[name="pick"]');
                  const allOn = [...boxes].every((b) => b.checked);
                  boxes.forEach((b) => {
                    b.checked = !allOn;
                  });
                }}
              >
                전체 선택 / 해제
              </Button>
              <Button type="submit" size="sm" disabled={attaching || withPhoto.length === 0}>
                {attaching ? "붙이는 중…" : "체크한 사진 붙이기"}
              </Button>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c) => (
              <li key={c.whiskyId}>
                <Card className="h-full overflow-hidden">
                  {c.photo ? (
                    <label className="block cursor-pointer">
                      <div className="relative aspect-square bg-black/30">
                        <Image
                          src={c.photo.thumbUrl}
                          alt={c.photo.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 320px"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <CardContent className="space-y-2 p-3 text-xs">
                        <p className="font-medium text-amber-100">{c.whiskyLabel}</p>
                        <p className="text-muted-foreground">
                          촬영 {c.photo.credit} ·{" "}
                          <span className="text-amber-200">{c.photo.license}</span>
                        </p>
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="pick"
                            value={[
                              c.whiskyId,
                              c.photo.imageUrl,
                              c.photo.sourceUrl,
                              c.photo.license,
                              c.photo.credit,
                            ].join("|")}
                            className="size-4 accent-amber-500"
                          />
                          <span>이 사진 붙이기</span>
                        </span>
                      </CardContent>
                    </label>
                  ) : (
                    <CardContent className="space-y-2 p-3 text-xs">
                      <p className="font-medium text-muted-foreground">{c.whiskyLabel}</p>
                      <p className="text-muted-foreground">{c.note}</p>
                    </CardContent>
                  )}
                  {c.photo && (
                    <div className="px-3 pb-3">
                      <a
                        href={c.photo.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-amber-300 hover:underline"
                      >
                        커먼즈에서 원본 보기
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </form>
      )}
    </div>
  );
}
