"use client";

import Link from "next/link";
import { WHISKIES } from "@/data/whiskies";
import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, GlassWater, ImagePlus, NotebookPen, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BottlingLoader } from "@/components/whisky/bottling-loader";
import { ScanOverlay, scanRegionLabel } from "@/components/whisky/scan-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatchBadge } from "@/components/whisky/whisky-card";
import { STYLE_EMOJI, STYLE_LABELS_KO } from "@/lib/whisky/format";
import { extractAppearance } from "@/lib/whisky/appearance";
import { saveScanAppearance, submitScan, type ScanResult } from "./actions";

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [revealed, setRevealed] = useState<ScanResult | null>(null);

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
    setPhase("loading");
    setRevealed(null);
    startTransition(async () => {
      const r = await submitScan({ imageBase64: base64, mediaType: "image/jpeg" });

      // 인식이 끝났으면 사진에서 진짜 라벨 그림과 액체 색을 꺼내 저장해요.
      // 이걸로 그 병의 3D 가 모두에게 실물에 가까워져요. 실패해도 조용히 넘어가요 —
      // 스캔은 이미 끝났고 이건 덤이라, 여기서 오류를 띄우면 사용자만 놀라요.
      if (r.ok && r.photoId && r.whisky && preview && r.result.regions.length > 0) {
        const { labelDataUrl, liquidHex } = await extractAppearance(preview, r.result.regions);
        if (labelDataUrl || liquidHex) {
          await saveScanAppearance({
            photoId: r.photoId,
            whiskyId: r.whisky.id,
            labelPng: labelDataUrl,
            liquidHex,
          });
        }
      }
      setOutcome(r);
      if (!r.ok) {
        toast.error(r.error);
        setPhase("idle");
        setRevealed(r);
        return;
      }
      setPhase("done");
    });
  }
  const busy = pending || (phase !== "idle" && revealed === null);

  function reset() {
    setPreview(null);
    setBase64(null);
    setOutcome(null);
    setRevealed(null);
    setPhase("idle");
    // 두 입력 모두 비워야 **같은 사진을 다시 골라도** onChange 가 다시 떠요
    if (inputRef.current) inputRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        {/*
          입력을 두 개 두는 이유: `capture` 가 붙어 있으면 모바일에서 **앨범을
          못 열고 카메라만 켜져요.** 이미 찍어둔 사진으로 스캔하고 싶은 경우가
          훨씬 많아서, 기본은 앨범이고 카메라는 따로 눌러 쓰게 했어요.
        */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[240px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors hover:border-amber-400/60 data-[has-photo=true]:border-solid data-[has-photo=true]:border-amber-400/25 data-[has-photo=true]:p-0"
          data-has-photo={preview ? "true" : "false"}
        >
          {preview ? (
            // 좌표 박스를 정확히 겹치려면 사진이 잘리면 안 돼요 (object-cover 금지).
            // 그래서 미리보기부터 오버레이 컴포넌트로 보여줘요.
            <ScanOverlay
              src={preview}
              regions={revealed?.ok ? revealed.result.regions : []}
              scanning={busy}
            />
          ) : (
            <>
              <ImagePlus className="size-10" aria-hidden />
              <span className="font-medium text-foreground">앨범에서 사진 고르기</span>
              <span className="px-6 text-center text-xs">
                라벨이 정면으로 보이게, 밝은 곳에서 찍은 사진이 잘 읽혀요.
              </span>
            </>
          )}
        </button>
        <div className="flex gap-2">
          {preview ? (
            <>
              <Button variant="outline" onClick={reset} disabled={busy}>
                <RotateCcw data-icon="inline-start" />
                다시 고르기
              </Button>
              <Button onClick={scan} disabled={busy} className="flex-1">
                <Sparkles data-icon="inline-start" />
                {busy ? "라벨을 읽는 중…" : "이 병 알아보기"}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => inputRef.current?.click()} disabled={busy} className="flex-1">
                <ImagePlus data-icon="inline-start" />
                앨범에서 고르기
              </Button>
              {/* 카메라는 따로. 예전엔 이것만 열려서 앨범 사진을 못 썼어요. */}
              <Button
                variant="outline"
                onClick={() => cameraRef.current?.click()}
                disabled={busy}
              >
                <Camera data-icon="inline-start" />
                찍기
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        {busy && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <BottlingLoader
              done={phase === "done"}
              lines={["라벨을 읽는 중…", `${WHISKIES.length}병 사전에서 찾는 중…`, "취향과 맞춰보는 중…"]}
              onComplete={() => {
                setRevealed(outcome);
                setPhase("idle");
              }}
            />
            <p className="text-sm text-muted-foreground">보통 5~10초 걸려요.</p>
          </div>
        )}

        {!busy && revealed?.ok && revealed.whisky && (
          <Card className="border-amber-400/40">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    라벨 인식 · {CONFIDENCE_LABEL[revealed.result.confidence]}
                  </p>
                  <h2 className="text-xl font-bold">
                    <Link href={`/whisky/${revealed.whisky.id}`} className="hover:underline">
                      {revealed.whisky.nameKo}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {revealed.whisky.name} · {revealed.whisky.typeLabel} · {revealed.whisky.abv}%
                  </p>
                </div>
                <MatchBadge percent={revealed.result.percent} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{revealed.whisky.price}</Badge>
                {revealed.whisky.styles.map((t) => (
                  <Badge key={t} className="bg-amber-500/15 text-amber-200">
                    {STYLE_EMOJI[t]} {STYLE_LABELS_KO[t]}
                  </Badge>
                ))}
              </div>

              {revealed.result.verdict && (
                <div className="space-y-2 rounded-xl bg-amber-500/10 p-4">
                  <p className="font-semibold text-amber-200">
                    {personalized ? "내 취향 판정: " : ""}
                    {revealed.result.verdict.headline}
                  </p>
                  <p className="text-sm leading-relaxed">{revealed.result.verdict.reason}</p>
                  <p className="flex gap-2 text-sm">
                    <GlassWater className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
                    {revealed.result.verdict.howToDrink}
                  </p>
                  {revealed.result.verdict.caution && (
                    <p className="flex gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {revealed.result.verdict.caution}
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

              {revealed.alternatives.length > 0 && (
                <div className="text-sm">
                  <p className="mb-1 text-muted-foreground">혹시 이 병인가요?</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {revealed.alternatives.map((a) => (
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
                <Button size="sm" render={<Link href={`/whisky/${revealed.whisky.id}`} />}>
                  자세히 보기
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/journal?whisky=${revealed.whisky.id}`} />}
                >
                  <NotebookPen data-icon="inline-start" />
                  마셨다면 후기 남기기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!busy && revealed?.ok && revealed.result.regions.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-sm font-semibold text-amber-100">이렇게 읽었어요</p>
              <ul className="space-y-1 text-sm">
                {revealed.result.regions.map((r, i) => (
                  <li key={`${r.kind}-${i}`} className="flex gap-2">
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200">
                      {scanRegionLabel(r.kind)}
                    </span>
                    <span className="min-w-0 break-words text-amber-50/90">{r.text}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                사진 위의 노란 상자가 각각 어디서 읽은 글자인지 보여줘요.
              </p>
            </CardContent>
          </Card>
        )}

        {!busy && revealed?.ok && !revealed.whisky && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="font-semibold">사전에 없는 병이에요</p>
              {revealed.result.guessName && (
                <p className="text-sm">
                  라벨은 <b>{revealed.result.guessName}</b>(으)로 읽혔어요.
                </p>
              )}
              {revealed.result.readText && (
                <p className="text-xs text-muted-foreground">읽은 글자: {revealed.result.readText}</p>
              )}
              <p className="text-sm text-muted-foreground">
                사전에는 {"국내에서 구할 수 있는 병 위주로"} {WHISKIES.length}병이 있어요. 비슷한 병을 검색해보거나,
                다른 각도에서 다시 찍어보세요.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" render={<Link href="/whisky" />}>
                  사전에서 검색
                </Button>
                <Button size="sm" variant="ghost" onClick={reset}>
                  다른 사진으로
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!busy && revealed && !revealed.ok && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="font-semibold">인식에 실패했어요</p>
              <p className="text-sm text-muted-foreground">{revealed.error}</p>
              <Button size="sm" variant="outline" render={<Link href="/whisky" />}>
                사전에서 검색
              </Button>
            </CardContent>
          </Card>
        )}

        {!busy && !revealed && (
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
