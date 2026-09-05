/**
 * 지구본 표면 텍스처를 브라우저에서 직접 만들어요.
 *
 * three-globe 가 주는 earth-dark.jpg 는 바다와 육지가 둘 다 어두워서 구분이 안 돼요.
 * 그래서 수륙 마스크(earth-water.png)를 읽어 육지는 밝은 위스키색, 바다는 거의 검은 갈색,
 * 해안선은 황동색으로 다시 칠해요. 결과는 Blob URL 로 돌려주고 globeImageUrl 에 넣어요.
 *
 * 마스크의 색이 어느 쪽이 물인지 가정하지 않아요. 태평양 한가운데(0°, -150°)와
 * 사하라(22°, 12°) 픽셀을 샘플로 찍어서 판별해요.
 */

/** 바다 (아주 어두운 갈색) */
const OCEAN: [number, number, number] = [10, 8, 6];
/** 육지 기본색 */
const LAND: [number, number, number] = [104, 82, 52];
/** 해안선 (황동) — 물과 땅 사이에서만 잠깐 나타나요 */
const COAST: [number, number, number] = [178, 140, 68];

const MASK_URL = "/textures/earth-water.png";

/**
 * 마스크가 1600×800 이라 스페이사이드처럼 가까이 확대하면 픽셀이 커 보여요.
 * 2배로 늘려 그리면 브라우저가 보간해줘서 해안선이 계단이 아니라 그라데이션이 돼요.
 */
const UPSCALE = 2;

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/** 등장방형 도법: 위경도 → 마스크 픽셀 인덱스 */
function pixelIndex(lat: number, lng: number, w: number, h: number): number {
  const x = Math.min(w - 1, Math.max(0, Math.round(((lng + 180) / 360) * w)));
  const y = Math.min(h - 1, Math.max(0, Math.round(((90 - lat) / 180) * h)));
  return (y * w + x) * 4;
}

/**
 * 육지가 밝게 보이는 지구본 텍스처를 만들어요.
 * 실패하면 null — 호출부에서 기본 텍스처로 폴백해요.
 */
export async function buildLandTextureUrl(): Promise<string | null> {
  try {
    const img = await loadImage(MASK_URL);
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const w = img.naturalWidth * UPSCALE;
    const h = img.naturalHeight * UPSCALE;

    const src = document.createElement("canvas");
    src.width = w;
    src.height = h;
    const sctx = src.getContext("2d", { willReadFrequently: true });
    if (!sctx) return null;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    // 살짝 흐리게 그려서 해안선이 계단이 아니라 부드러운 띠가 되게 해요.
    // (원본이 0/255 이분 마스크라 이 과정이 없으면 확대했을 때 각져 보여요)
    sctx.filter = "blur(2.5px)";
    sctx.drawImage(img, 0, 0, w, h);
    sctx.filter = "none";
    const data = sctx.getImageData(0, 0, w, h).data;

    // 물 / 땅 기준 밝기 (마스크 색상 규칙을 가정하지 않아요)
    const luma = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const waterL = luma(pixelIndex(0, -150, w, h)); // 태평양
    const landL = luma(pixelIndex(22, 12, w, h)); // 사하라
    const span = landL - waterL;
    if (Math.abs(span) < 30) return null; // 마스크로 못 써요

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    if (!octx) return null;
    const dst = octx.createImageData(w, h);
    const o = dst.data;

    for (let y = 0; y < h; y++) {
      // 위도가 높을수록 살짝 차갑고 어둡게
      const lat = 90 - (y / h) * 180;
      const cool = 1 - Math.min(1, Math.abs(lat) / 90) * 0.26;
      const land: [number, number, number] = [LAND[0] * cool, LAND[1] * cool, LAND[2] * cool];
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // 0 = 완전한 바다, 1 = 완전한 육지
        const t = smoothstep((luma(i) - waterL) / span);
        // 가장자리(0.5 부근)에서만 황동빛이 살짝 올라와요
        const edge = 1 - Math.abs(t - 0.5) * 2;
        const base = mix(OCEAN, land, t);
        const c = mix(base, COAST, edge * 0.75);
        o[i] = c[0];
        o[i + 1] = c[1];
        o[i + 2] = c[2];
        o[i + 3] = 255;
      }
    }
    octx.putImageData(dst, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}
