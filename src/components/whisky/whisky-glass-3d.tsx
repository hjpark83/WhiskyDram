"use client";

import { useEffect, useRef } from "react";
import { subscribeLight } from "@/lib/light";
import { cn } from "@/lib/utils";

/**
 * Three.js 로 그리는 입체 락 글라스.
 * - 굴절되는 유리(transmission), 호박색 액체, 떠 있는 얼음, 바닥 그림자
 * - 키 라이트는 사이트 조명(lib/light.ts)과 같은 각도로 잔 주위를 돌아요
 * - 액체는 천천히 기울며 찰랑여요
 */
export function WhiskyGlass3D({
  size = 240,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const height = Math.round(size * 1.2);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
      if (disposed) return;

      const w = size;
      const h = height;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return; // WebGL 불가 환경
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      // 캔버스는 페이지 배경색으로 불투명하게 그려요. 투명 캔버스면 three 가 굴절 버퍼를
      // 흰색으로 지워서 유리가 하얗게 보여요. 가장자리는 CSS 마스크로 페이지에 녹여요.
      renderer.setClearColor(0x1a120c, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.style.display = "block";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
      camera.position.set(0, 1.9, 7.6);
      camera.lookAt(0, 1.0, 0);

      const root = new THREE.Group();
      scene.add(root);

      // ── 유리 (닫힌 회전체: 바닥 중심 → 바깥 벽 → 림 → 안쪽 벽 → 안쪽 바닥) ──
      const glassProfile = [
        [0, 0], [0.86, 0], [0.92, 0.06], [0.98, 2.15], [1.0, 2.3], [0.92, 2.3],
        [0.9, 2.15], [0.82, 0.46], [0.5, 0.4], [0, 0.4],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const glassGeo = new THREE.LatheGeometry(glassProfile, 128);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.04,
        transmission: 1,
        thickness: 0.5,
        ior: 1.5,
        clearcoat: 0.7,
        clearcoatRoughness: 0.05,
        envMapIntensity: 0.18,
        specularIntensity: 0.8,
        attenuationColor: new THREE.Color(0xf7efe0),
        attenuationDistance: 4,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.castShadow = true;
      root.add(glass);

      // ── 액체 (안쪽 벽을 따라, 수면은 살짝 오목) ──
      const level = 1.45;
      const liquidProfile = [
        [0, 0.41], [0.55, 0.42], [0.815, 0.47], [0.86, level - 0.02], [0.6, level], [0, level - 0.03],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const liquidGeo = new THREE.LatheGeometry(liquidProfile, 128);
      // 액체·얼음은 transmission·transparent 를 쓰지 않아요: three 의 굴절 버퍼에는
      // 불투명 물체만 담겨서, 아니면 유리 안에서 사라져요. 대신 자체 발광으로 호박색이 빛나게.
      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: 0xc9721a,
        roughness: 0.22,
        metalness: 0,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        envMapIntensity: 0.35,
        emissive: new THREE.Color(0x7a3406),
        emissiveIntensity: 0.55,
      });
      const liquidGroup = new THREE.Group();
      liquidGroup.position.y = 0.9; // 회전 기준을 액체 가운데로
      const liquid = new THREE.Mesh(liquidGeo, liquidMat);
      liquid.position.y = -0.9;
      liquidGroup.add(liquid);
      root.add(liquidGroup);

      // ── 얼음 ──
      const iceMat = new THREE.MeshPhysicalMaterial({
        color: 0xdfeeff,
        roughness: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        envMapIntensity: 0.5,
        emissive: new THREE.Color(0x3a4a5a),
        emissiveIntensity: 0.25,
      });
      const ice1 = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.72, 0.72, 4, 0.12), iceMat);
      ice1.position.set(0.22, 1.28, 0.1);
      ice1.rotation.set(0.3, 0.6, 0.15);
      const ice2 = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.1), iceMat);
      ice2.position.set(-0.3, 1.05, -0.15);
      ice2.rotation.set(0.5, -0.4, 0.4);
      root.add(ice1, ice2);

      // ── 바닥 그림자 + 은은한 빛 웅덩이 ──
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.38 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.6, 48),
        new THREE.MeshBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0.12 }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.002;
      scene.add(pool);

      // ── 조명 ──
      scene.add(new THREE.AmbientLight(0xffe4c0, 0.2));
      const key = new THREE.SpotLight(0xffdca8, 70, 30, Math.PI / 6, 0.7, 1.4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0005;
      key.target.position.set(0, 1, 0);
      scene.add(key, key.target);
      const fill = new THREE.PointLight(0x8a2f3a, 10, 20, 1.6);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xfff4e0, 0.9);
      rim.position.set(-3, 5, -4);
      scene.add(rim);
      // 액체가 안에서 빛나 보이게 뒤에서 비추는 따뜻한 빛
      const back = new THREE.PointLight(0xffb347, 14, 12, 1.5);
      back.position.set(0.4, 1.0, -2.2);
      scene.add(back);

      // ── 애니메이션 ──
      let lightAngle = 0.6;
      const unsub = subscribeLight((s) => {
        lightAngle = s.angle;
      });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        const t = (now - start) / 1000;
        const a = lightAngle;
        key.position.set(Math.cos(a) * 3.4, 4.6, Math.sin(a) * 3.4 + 0.5);
        fill.position.set(-Math.cos(a) * 3, 1.8, -Math.sin(a) * 3);
        if (!reduced) {
          liquidGroup.rotation.z = Math.sin(t * 1.25) * 0.065;
          liquidGroup.rotation.x = Math.cos(t * 0.95) * 0.04;
          ice1.position.y = 1.28 + Math.sin(t * 1.1) * 0.03;
          ice1.rotation.y += 0.0025;
          ice2.position.y = 1.05 + Math.cos(t * 0.9 + 1) * 0.025;
          ice2.rotation.z -= 0.002;
          root.rotation.y = Math.sin(t * 0.25) * 0.18;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        unsub();
        glassGeo.dispose();
        liquidGeo.dispose();
        ice1.geometry.dispose();
        ice2.geometry.dispose();
        glassMat.dispose();
        liquidMat.dispose();
        iceMat.dispose();
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
  }, [size, height]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn("relative inline-block select-none", className)}
      style={{
        width: size,
        height,
        maskImage: "radial-gradient(ellipse 56% 58% at 50% 52%, #000 45%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 56% 58% at 50% 52%, #000 45%, transparent 100%)",
      }}
    />
  );
}
