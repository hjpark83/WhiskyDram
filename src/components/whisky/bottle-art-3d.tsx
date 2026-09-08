"use client";

import { useEffect, useRef, useState } from "react";
import { BottleArt } from "@/components/whisky/bottle-art";
import { labelName } from "@/lib/whisky/bottle-label";
import { liquidColor } from "@/lib/whisky/format";
import { cn } from "@/lib/utils";
import type { Whisky } from "@/lib/whisky/types";

/**
 * 돌려볼 수 있는 입체 병.
 *
 * **실물 사진이 아니에요.** 브랜드 제품 사진은 저작권이 있고, AI 로 만들면
 * 라벨을 틀리게 그려서 "이 병이 그 병인가" 를 확인하는 데는 오히려 해로워요.
 * 그건 사용자가 직접 찍어 올린 사진(`whisky_photos`)이 할 일이에요.
 *
 * 여기 3D 가 하는 건 다른 일이에요 — **액체 색과 병 모양을 실제 부피감으로
 * 보여주는 것.** 셰리 통에서 익힌 진한 병과 버번 통의 옅은 병이 나란히 있을 때
 * 그 차이가 평면 그림보다 훨씬 잘 보여요.
 *
 * 만드는 방식도 그림(SVG)과 같아요: 가진 데이터(숙성·통 종류·도수)로 계산해요.
 * 그래서 504병 전부에 자동으로 붙고 에셋 파일이 하나도 없어요.
 */

type Silhouette = "malt" | "bourbon" | "irish" | "japanese" | "squat";

function silhouetteFor(w: Whisky): Silhouette {
  if (w.type === "bourbon" || w.type === "rye") return "bourbon";
  if (w.type === "japanese") return "japanese";
  if (w.type === "irish") return "irish";
  if (w.styles.includes("sherry")) return "squat";
  return "malt";
}

/** 병 옆면 실루엣 (반지름, 높이). 이걸 한 바퀴 돌려서 병을 만들어요. */
interface Shape {
  bodyR: number;
  bodyTop: number;
  neckR: number;
  neckTop: number;
  /** 어깨가 얼마나 각진지 (0 둥글게 ~ 1 각지게) */
  square: number;
}

const SHAPES: Record<Silhouette, Shape> = {
  malt: { bodyR: 0.70, bodyTop: 1.95, neckR: 0.21, neckTop: 3.15, square: 0.25 },
  squat: { bodyR: 0.80, bodyTop: 1.75, neckR: 0.22, neckTop: 3.05, square: 0.2 },
  bourbon: { bodyR: 0.72, bodyTop: 1.85, neckR: 0.22, neckTop: 3.0, square: 0.7 },
  irish: { bodyR: 0.66, bodyTop: 2.0, neckR: 0.2, neckTop: 3.25, square: 0.35 },
  japanese: { bodyR: 0.70, bodyTop: 2.0, neckR: 0.21, neckTop: 3.1, square: 0.85 },
};

/**
 * 액체가 차오르는 높이. 그림(SVG)과 같은 규칙이라 둘이 어긋나지 않아요.
 * 도수가 높을수록 조금 덜 채워 보이게 해서 병마다 표정이 달라져요.
 */
function fillHeight(w: Whisky, shape: Shape): number {
  const t = Math.min(1, Math.max(0.82, 0.95 - (w.abv - 43) / 120));
  return shape.bodyTop * t + 0.25;
}

/** 라벨 그림을 캔버스에 그려서 병에 감아요 */
function makeLabelTexture(w: Whisky): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 512;
  const c = cv.getContext("2d")!;

  c.fillStyle = "#f3e7d3";
  c.fillRect(0, 0, 1024, 512);
  c.strokeStyle = "rgba(138,107,52,0.45)";
  c.lineWidth = 7;
  c.strokeRect(26, 26, 972, 460);

  const { lines, size } = labelName(w);
  c.fillStyle = "#5a3f1c";
  c.textAlign = "center";

  // 라벨은 병 둘레의 절반에 감기니까 가로로 늘어나 보여요. 그만큼 작게 잡아요.
  const px = (size / 21.5) * 620;
  lines.forEach((line, i) => {
    c.font = `600 ${px}px Georgia, 'Times New Roman', serif`;
    c.fillText(line.toUpperCase(), 512, 130 + i * (px + 12));
  });

  const afterName = 130 + (lines.length - 1) * (px + 12);
  c.fillStyle = "rgba(138,107,52,0.5)";
  c.fillRect(392, afterName + 34, 240, 5);

  if (w.age !== null) {
    c.fillStyle = "#5a3f1c";
    c.font = "700 168px Georgia, 'Times New Roman', serif";
    c.fillText(String(w.age), 512, 400);
    c.fillStyle = "rgba(138,107,52,0.85)";
    c.font = "500 40px Georgia, 'Times New Roman', serif";
    c.fillText("YEARS", 512, 452);
  } else {
    c.fillStyle = "rgba(138,107,52,0.55)";
    c.beginPath();
    c.moveTo(512, 310);
    c.lineTo(556, 356);
    c.lineTo(512, 402);
    c.lineTo(468, 356);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(138,107,52,0.85)";
    c.font = "500 40px Georgia, 'Times New Roman', serif";
    c.fillText(`${w.abv.toFixed(1)}% ABV`, 512, 460);
  }
  return cv;
}

export function BottleArt3D({
  whisky,
  size = 260,
  className,
}: {
  whisky: Whisky;
  size?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // WebGL 이 없는 환경(오래된 기기·일부 인앱 브라우저)에서는 그림으로 돌아가요
  const [failed, setFailed] = useState(false);
  const height = Math.round(size * 1.35);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import(
        "three/examples/jsm/environments/RoomEnvironment.js"
      );
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
      } catch {
        setFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      // 투명 캔버스면 three 가 굴절 버퍼를 흰색으로 지워서 유리가 하얗게 떠요.
      // 페이지 배경색으로 불투명하게 그리고 가장자리는 CSS 마스크로 녹여요.
      renderer.setClearColor(0x1a120c, 1);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "pan-y";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(30, size / height, 0.1, 50);
      camera.position.set(0, 1.75, 7.4);
      camera.lookAt(0, 1.6, 0);

      const root = new THREE.Group();
      scene.add(root);

      const shape = SHAPES[silhouetteFor(whisky)];

      /** 어깨를 곡선으로 이어요 (점을 촘촘히 찍어야 각지지 않아요) */
      const shoulder = (r0: number, y0: number, r1: number, y1: number, square: number) => {
        const pts: [number, number][] = [];
        // 조절점을 몸통 쪽으로 당길수록 어깨가 각져요
        const cx = r0 * (0.35 + square * 0.6) + r1 * (0.65 - square * 0.6);
        const cy = y0 + (y1 - y0) * (0.15 + square * 0.55);
        for (let i = 1; i <= 14; i += 1) {
          const t = i / 14;
          const m = 1 - t;
          pts.push([
            m * m * r0 + 2 * m * t * cx + t * t * r1,
            m * m * y0 + 2 * m * t * cy + t * t * y1,
          ]);
        }
        return pts;
      };

      const neckStart = shape.bodyTop + (shape.neckTop - shape.bodyTop) * 0.45;
      const outline: [number, number][] = [
        [0, 0],
        [shape.bodyR - 0.06, 0],
        [shape.bodyR, 0.07],
        [shape.bodyR, shape.bodyTop],
        ...shoulder(shape.bodyR, shape.bodyTop, shape.neckR, neckStart, shape.square),
        [shape.neckR, shape.neckTop],
        [shape.neckR * 1.15, shape.neckTop + 0.02],
        [shape.neckR * 1.15, shape.neckTop + 0.1],
        [0, shape.neckTop + 0.1], // 위를 막아서 속이 찬 유리로 (마개가 덮어요)
      ];

      const glassGeo = new THREE.LatheGeometry(
        outline.map(([r, y]) => new THREE.Vector2(r, y)),
        96,
      );
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.05,
        transmission: 1,
        thickness: 0.35,
        ior: 1.5,
        clearcoat: 0.6,
        clearcoatRoughness: 0.06,
        envMapIntensity: 0.22,
        attenuationColor: new THREE.Color(0xd8e6da),
        attenuationDistance: 6,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      root.add(glass);

      // ── 액체: 유리 안쪽을 따라 같은 실루엣을 조금 줄여서 ──
      const { hex } = liquidColor(whisky);
      const top = fillHeight(whisky, shape);
      const inner = outline
        .filter(([, y]) => y <= top)
        .map(([r, y]) => [r * 0.9, y] as [number, number]);
      inner.push([
        (outline.find(([, y]) => y > top)?.[0] ?? shape.neckR) * 0.9,
        top,
      ]);
      inner.push([0, top]);

      const liquidGeo = new THREE.LatheGeometry(
        inner.map(([r, y]) => new THREE.Vector2(r, y)),
        96,
      );
      const liquid = new THREE.Color(hex);
      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: liquid,
        roughness: 0.08,
        metalness: 0,
        transmission: 0.72,
        thickness: 1.2,
        ior: 1.37,
        attenuationColor: liquid,
        attenuationDistance: 0.9,
        envMapIntensity: 0.5,
        emissive: liquid,
        emissiveIntensity: 0.12,
        // three 는 DoubleSide 투과 물체만 굴절 버퍼에 그려요.
        // 아니면 유리 뒤에서 액체가 사라져요.
        side: THREE.DoubleSide,
      });
      root.add(new THREE.Mesh(liquidGeo, liquidMat));

      // ── 라벨 ──
      const labelCanvas = makeLabelTexture(whisky);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      labelTex.wrapS = THREE.RepeatWrapping;
      labelTex.repeat.x = 2; // 앞뒤로 한 번씩 (돌려도 라벨이 보여요)
      // three 의 실린더는 u=0 이 정면(+Z)이라, 그냥 두면 텍스처 **이음매가 정면에**
      // 와서 이름이 "LIN | LAG" 처럼 갈려요. 반 칸 밀어 라벨 가운데를 정면에 둬요.
      labelTex.offset.x = 0.5;
      const labelH = shape.bodyTop * 0.46;
      const label = new THREE.Mesh(
        new THREE.CylinderGeometry(shape.bodyR * 1.008, shape.bodyR * 1.008, labelH, 96, 1, true),
        new THREE.MeshStandardMaterial({
          map: labelTex,
          roughness: 0.85,
          metalness: 0,
          side: THREE.DoubleSide,
        }),
      );
      label.position.y = shape.bodyTop * 0.42;
      root.add(label);

      // 목에 두른 얇은 띠
      const bandMat = new THREE.MeshStandardMaterial({ color: 0xf3e7d3, roughness: 0.8 });
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(shape.neckR * 1.06, shape.neckR * 1.06, 0.22, 48, 1, true),
        bandMat,
      );
      band.position.y = shape.neckTop - 0.34;
      root.add(band);

      // ── 마개 ──
      const corkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.75 });
      const cork = new THREE.Mesh(
        new THREE.CylinderGeometry(shape.neckR * 1.2, shape.neckR * 1.12, 0.34, 32),
        corkMat,
      );
      cork.position.y = shape.neckTop + 0.26;
      root.add(cork);

      // ── 조명 ──
      scene.add(new THREE.AmbientLight(0xffe4c0, 0.35));
      const key = new THREE.DirectionalLight(0xfff0d6, 2.2);
      key.position.set(2.6, 5, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffd9a0, 1.1);
      rim.position.set(-3, 3, -3);
      scene.add(rim);
      // 액체가 안에서 빛나 보이게 뒤에서 비추는 빛
      const back = new THREE.PointLight(0xffb347, 14, 12, 1.6);
      back.position.set(0, 1.4, -2.4);
      scene.add(back);

      // ── 손으로 돌리기 ──
      let spin = 0;
      let dragging = false;
      let lastX = 0;
      let velocity = 0;
      const el = renderer.domElement;
      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        el.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        spin += dx * 0.01;
        velocity = dx * 0.01;
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        el.releasePointerCapture(e.pointerId);
      };
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let raf = 0;
      const tick = () => {
        if (!dragging) {
          // 손을 떼면 여운으로 조금 더 돌다가, 천천히 자동 회전으로 돌아가요
          velocity *= 0.94;
          spin += velocity + (reduced ? 0 : 0.0022);
        }
        root.rotation.y = spin;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        scene.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as { dispose?: () => void } | undefined;
          mat?.dispose?.();
        });
        labelTex.dispose();
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [whisky, size, height]);

  if (failed) {
    return (
      <div className={cn("h-40 w-16", className)}>
        <BottleArt whisky={whisky} />
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`${whisky.nameKo} 입체 병 그림. 끌어서 돌려볼 수 있어요.`}
      className={cn("relative inline-block cursor-grab select-none active:cursor-grabbing", className)}
      style={{
        width: size,
        height,
        maskImage: "radial-gradient(ellipse 62% 62% at 50% 50%, #000 55%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 62% 62% at 50% 50%, #000 55%, transparent 100%)",
      }}
    />
  );
}
