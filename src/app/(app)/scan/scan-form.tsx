"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, GlassWater, ImagePlus, NotebookPen, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatchBadge } from "@/components/whisky/whisky-card";
import { STYLE_EMOJI, STYLE_LABELS_KO } from "@/lib/whisky/format";
import { submitScan, type ScanResult } from "./actions";

const MAX_EDGE = 1280;

/** 브라우저에서 미리 줄여서 보내요 (서버 액션 용량·속도) */
async function shrinkImage(file: File): Promise<{ dataUrl: string; base64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { dataUrl, base64: dataUrl.split(",")[1] };
}

const CONFIDENCE_LABEL = { high: "확실해요", medium: "브랜드는 맞는데 연수는 확인해보세요", low: "잘 안 보여요" };

export function ScanForm({ personalized }: { personalized: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 올릴 수 있어요.");
      return;
    }
    try {
      const { dataUrl, base64 } = await shrinkImage(file);
      setPreview(dataUrl);
      setBase64(base64);
      setOutcome(null);
    } catch {
      toast.error("사진을 읽지 못했어요. 다른 사진으로 시도해주세요.");
    }
  }

  function scan() {
    if (!base64) return;
    startTransition(async () => {
      const r = await submitScan({ imageBase64: base64, mediaType: "image/jpeg" });
      setOutcome(r);
      if (!r.ok) toast.error(r.error);
    });
  }

  function reset() {
    setPreview(null);
    setBase64(null);
    setOutcome(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors hover:border-amber-400/60"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="선택한 병 사진" className="h-full w-full object-cover" />
          ) : (
            <>
              <Camera className="size-10" aria-hidden />
              <span className="font-medium text-foreground">사진 찍기 또는 올리기</span>
              <span className="px-6 text-center text-xs">
                라벨이 정면으로 보이게, 밝은 곳에서 찍으면 잘 읽혀요.
              </span>
            </>
          )}
        </button>
        <div className="flex gap-2">
          {preview && (
            <Button variant="outline" onClick={reset} disabled={pending}>
              <RotateCcw data-icon="inline-start" />
              다시 찍기
            </Button>
          )}
          <Button onClick={preview ? scan : () => inputRef.current?.click()} disabled={pending} className="flex-1">
            {preview ? <Sparkles data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
            {pending ? "라벨을 읽는 중…" : preview ? "이 병 알아보기" : "사진 고르기"}
          </Button>
        </div>
      </div>

      <div>
        {pending && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <Sparkles className="size-8 animate-pulse text-amber-400" aria-hidden />
            <p className="font-semibold">라벨을 읽고 사전에서 찾는 중…</p>
            <p className="text-sm text-muted-foreground">보통 5~10초 걸려요.</p>
          </div>
        )}

        {!pending && outcome?.ok && outcome.whisky && (
          <Card className="border-amber-400/40">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    라벨 인식 · {CONFIDENCE_LABEL[outcome.result.confidence]}
                  </p>
                  <h2 className="text-xl font-bold">
                    <Link href={`/whisky/${outcome.whisky.id}`} className="hover:underline">
                      {outcome.whisky.nameKo}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {outcome.whisky.name} · {outcome.whisky.typeLabel} · {outcome.whisky.abv}%
                  </p>
                </div>
                <MatchBadge percent={outcome.result.percent} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{outcome.whisky.price}</Badge>
                {outcome.whisky.styles.map((t) => (
                  <Badge key={t} className="bg-amber-500/15 text-amber-200">
                    {STYLE_EMOJI[t]} {STYLE_LABELS_KO[t]}
                  </Badge>
                ))}
              </div>

              {outcome.result.verdict && (
                <div className="space-y-2 rounded-xl bg-amber-500/10 p-4">
                  <p className="font-semibold text-amber-200">
                    {personalized ? "내 취향 판정: " : ""}
                    {outcome.result.verdict.headline}
                  </p>
                  <p className="text-sm leading-relaxed">{outcome.result.verdict.reason}</p>
                  <p className="flex gap-2 text-sm">
                    <GlassWater className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
                    {outcome.result.verdict.howToDrink}
                  </p>
                  {outcome.result.verdict.caution && (
                    <p className="flex gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {outcome.result.verdict.caution}
                    </p>
                  )}
                </div>
              )}

              {!personalized && (
                <p className="text-xs text-muted-foreground">
                  <Link href="/quiz" className="underline">
                    취향 진단
                  </Link>
                  을 하면 이 병이 나와 몇 % 맞는지도 알려드려요.
                </p>
              )}

              {outcome.alternatives.length > 0 && (
                <div className="text-sm">
                  <p className="mb-1 text-muted-foreground">혹시 이 병인가요?</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {outcome.alternatives.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/whisky/${a.id}`}
                          className="rounded-full border px-3 py-1 text-xs hover:border-amber-400/60"
                        >
                          {a.nameKo}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" render={<Link href={`/whisky/${outcome.whisky.id}`} />}>
                  자세히 보기
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/journal?whisky=${outcome.whisky.id}`} />}
                >
                  <NotebookPen data-icon="inline-start" />
                  마셨다면 후기 남기기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!pending && outcome?.ok && !outcome.whisky && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="font-semibold">사전에 없는 병이에요</p>
              {outcome.result.guessName && (
                <p className="text-sm">
                  라벨은 <b>{outcome.result.guessName}</b>(으)로 읽혔어요.
                </p>
              )}
              {outcome.result.readText && (
                <p className="text-xs text-muted-foreground">읽은 글자: {outcome.result.readText}</p>
              )}
              <p className="text-sm text-muted-foreground">
                사전에는 {"국내에서 구할 수 있는 병 위주로"} 312병이 있어요. 비슷한 병을 검색해보거나,
                다른 각도에서 다시 찍어보세요.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" render={<Link href="/whisky" />}>
                  사전에서 검색
                </Button>
                <Button size="sm" variant="ghost" onClick={reset}>
                  다시 찍기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!pending && outcome && !outcome.ok && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="font-semibold">인식에 실패했어요</p>
              <p className="text-sm text-muted-foreground">{outcome.error}</p>
              <Button size="sm" variant="outline" render={<Link href="/whisky" />}>
                사전에서 검색
              </Button>
            </CardContent>
          </Card>
        )}

        {!pending && !outcome && (
          <div className="flex h-full min-h-[240px] flex-col justify-center gap-3 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">이렇게 써보세요</p>
            <ul className="space-y-1">
              <li>· 마트·바에서 처음 보는 병을 찍으면 어떤 병인지 알려줘요.</li>
              <li>· 취향 진단이 돼 있으면 “지금 내 취향과 몇 % 맞는지”까지 판정해요.</li>
              <li>· 사전에 있는 312병 안에서 찾아요. 없으면 읽은 이름을 보여줘요.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
