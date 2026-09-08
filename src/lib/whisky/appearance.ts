import type { ScanRegion } from "@/lib/ai/scan";

/**
 * 사용자가 찍은 사진에서 **라벨 그림과 액체 색**을 꺼내요.
 *
 * ## 왜 이걸 하나
 *
 * 3D 병은 이름으로 그린 가짜 라벨을 감고, 액체 색은 숙성 연수·통 종류로
 * 계산했어요. 실물과 비슷하지는 않죠. 그런데 누군가 그 병을 스캔하면
 * **진짜 라벨과 진짜 색이 사진 안에 있어요.**
 *
 * 한 사람이 라가불린을 스캔하면 모든 사람의 라가불린 3D 병에 진짜 라벨이
 * 감기고 진짜 색이 들어가요. 사진 한 장이 사전 한 칸을 영구히 고치는 구조예요.
 *
 * ## 왜 브라우저에서 하나
 *
 * 사진은 이미 브라우저에 있고 캔버스로 자르고 읽으면 끝이에요. 서버로 원본을
 * 다시 보내 이미지 라이브러리를 돌릴 이유가 없어요. 서버는 결과(작은 PNG 와
 * 색 하나)만 받아요.
 *
 * ## 3D 생성이 아니에요
 *
 * 사진에서 메시를 만드는 건 안 해요. 유리병은 3D 재구성이 가장 안 되는
 * 대상이고(반사·투명), 무엇보다 사진이 있으면 사진을 보여주는 게 나아요.
 * 여기서 하는 건 **이미 있는 3D 를 실물에 가깝게 칠하는 것**뿐이에요.
 */

export interface BottleAppearance {
  /** 잘라낸 라벨 그림 (PNG data URL) */
  labelDataUrl: string | null;
  /** 액체 색 (#rrggbb) */
  liquidHex: string | null;
}

/** 스캔이 주는 좌표는 사진 크기를 0~1000 으로 본 값이에요 */
const SCALE = 1000;

/** 라벨 글자 조각들을 하나의 라벨 영역으로 합쳐요 */
function labelBox(regions: ScanRegion[]) {
  if (regions.length === 0) return null;
  let ymin = SCALE;
  let xmin = SCALE;
  let ymax = 0;
  let xmax = 0;
  for (const r of regions) {
    ymin = Math.min(ymin, r.box[0]);
    xmin = Math.min(xmin, r.box[1]);
    ymax = Math.max(ymax, r.box[2]);
    xmax = Math.max(xmax, r.box[3]);
  }
  // 글자 바깥의 라벨 여백까지 조금 넉넉히 (글자만 자르면 라벨 같지 않아요)
  const padX = (xmax - xmin) * 0.16;
  const padY = (ymax - ymin) * 0.22;
  return {
    ymin: Math.max(0, ymin - padY),
    xmin: Math.max(0, xmin - padX),
    ymax: Math.min(SCALE, ymax + padY),
    xmax: Math.min(SCALE, xmax + padX),
  };
}

/** RGB → HSL 의 채도·밝기만 (색이 진짜 술 색인지 거르려고) */
function satLum(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const lum = (mx + mn) / 2 / 255;
  const sat = mx === mn ? 0 : (mx - mn) / (mx + mn <= 255 ? mx + mn : 510 - mx - mn);
  return { sat, lum };
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 라벨 **위쪽** 띠에서 액체 색을 뽑아요.
 *
 * 위스키 병은 라벨 위가 술로 차 있는 게 보통이라 거기가 제일 안전해요.
 *
 * 처음엔 라벨 글자 높이를 기준으로 조금만 위를 봤는데, **라벨 크림색이 그대로
 * 뽑혔어요.** 스캔이 주는 좌표는 라벨 전체가 아니라 *글자*라서, 글자 높이만큼
 * 올라가도 아직 라벨 안이거든요. 그래서 **라벨 폭**(≈ 병 폭)을 기준으로 훨씬
 * 위를 봐요.
 *
 * 밝은 반사와 어두운 그림자는 빼고, 채도가 있는 픽셀만 모아 **중앙값**을 써요.
 * 평균을 쓰면 흰 반사 한 점에 색이 끌려가요.
 */
function sampleLiquid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): string | null {
  const px = (v: number, size: number) => Math.round((v / SCALE) * size);
  const left = px(box.xmin, w);
  const right = px(box.xmax, w);
  const labelTop = px(box.ymin, h);
  const labelW = right - left;
  if (labelW < 8) return null;

  const mid = (arr: number[]) => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];

  // 라벨 폭의 0.5~1.6배 위를 보되, 못 찾으면 조금씩 더 올라가요
  for (const [lo, hi] of [
    [0.5, 1.6],
    [1.2, 2.4],
    [0.15, 0.5],
  ] as const) {
    const bandBottom = labelTop - Math.round(labelW * lo);
    const bandTop = labelTop - Math.round(labelW * hi);
    const y0 = Math.max(0, bandTop);
    const y1 = Math.min(h, bandBottom);
    if (y1 - y0 < 4) continue;

    const data = ctx.getImageData(left, y0, right - left, y1 - y0).data;
    const reds: number[] = [];
    const greens: number[] = [];
    const blues: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const { sat, lum } = satLum(r, g, b);
      // 반사(너무 밝음)·그림자(너무 어두움)·무채색(유리·배경) 제외
      if (lum > 0.9 || lum < 0.12 || sat < 0.18) continue;
      // 위스키는 호박색이에요. 파랑이 빨강보다 진하면 술이 아니라 배경이에요.
      if (b >= r) continue;
      reds.push(r);
      greens.push(g);
      blues.push(b);
    }
    if (reds.length >= 40) return hex(mid(reds), mid(greens), mid(blues));
  }
  return null;
}

/** 라벨 영역을 잘라 가로로 긴 텍스처로 (3D 병에 감을 그림) */
function cropLabel(
  img: CanvasImageSource,
  w: number,
  h: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): string | null {
  const sx = Math.round((box.xmin / SCALE) * w);
  const sy = Math.round((box.ymin / SCALE) * h);
  const sw = Math.round(((box.xmax - box.xmin) / SCALE) * w);
  const sh = Math.round(((box.ymax - box.ymin) / SCALE) * h);
  if (sw < 24 || sh < 16) return null;

  // 3D 라벨 텍스처와 같은 비율 (1024×512)
  const out = document.createElement("canvas");
  out.width = 1024;
  out.height = 512;
  const c = out.getContext("2d");
  if (!c) return null;
  c.imageSmoothingQuality = "high";
  c.drawImage(img, sx, sy, sw, sh, 0, 0, 1024, 512);
  return out.toDataURL("image/png");
}

/**
 * 사진 + 스캔이 읽은 글자 위치 → 라벨 그림과 액체 색.
 * 못 뽑으면 null 이에요. 실패해도 스캔 흐름은 그대로 가야 해요.
 */
export async function extractAppearance(
  dataUrl: string,
  regions: ScanRegion[],
): Promise<BottleAppearance> {
  const empty: BottleAppearance = { labelDataUrl: null, liquidHex: null };
  const box = labelBox(regions);
  if (!box) return empty;

  try {
    const res = await fetch(dataUrl);
    const bitmap = await createImageBitmap(await res.blob());
    const w = bitmap.width;
    const h = bitmap.height;

    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return empty;
    ctx.drawImage(bitmap, 0, 0);

    return {
      labelDataUrl: cropLabel(bitmap, w, h, box),
      liquidHex: sampleLiquid(ctx, w, h, box),
    };
  } catch (error) {
    console.error("[appearance] 사진에서 라벨·색을 못 꺼냈어요", error);
    return empty;
  }
}
