"use client";

import { useEffect, useRef } from "react";
import { subscribeLight } from "@/lib/light";

/**
 * 페이지 뒤에서 천천히 움직이는 조명 레이어.
 * 따뜻한 키 라이트 하나와, 반대편의 은은한 버건디 필 라이트 하나.
 * React 상태 대신 DOM 스타일을 직접 갱신해요 (매 프레임 리렌더 방지).
 */
export function AmbientLight() {
  const keyRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeLight((s) => {
      const key = keyRef.current;
      const fill = fillRef.current;
      const beam = beamRef.current;
      if (key) key.style.transform = `translate(calc(${s.x * 100}vw - 50%), calc(${s.y * 100}vh - 50%))`;
      if (fill) fill.style.transform = `translate(calc(${(1 - s.x) * 100}vw - 50%), calc(${(1.1 - s.y) * 100}vh - 50%))`;
      if (beam) {
        // 조명 각도에 따라 살짝 기울어지는 빛줄기
        const tilt = Math.sin(s.angle * 0.5) * 8;
        beam.style.transform = `translate(calc(${s.x * 100}vw - 50%), -20%) rotate(${tilt}deg)`;
      }
    });
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
      <div
        ref={beamRef}
        className="absolute left-0 top-0 h-[120vh] w-[40vmax] opacity-70 will-change-transform"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,214,130,0.10) 0%, rgba(255,214,130,0.04) 40%, transparent 75%)",
          clipPath: "polygon(35% 0, 65% 0, 100% 100%, 0 100%)",
          filter: "blur(18px)",
        }}
      />
      <div
        ref={keyRef}
        className="absolute left-0 top-0 size-[95vmax] will-change-transform"
        style={{
          background:
            "radial-gradient(circle at center, rgba(255,214,130,0.24) 0%, rgba(217,164,65,0.10) 28%, transparent 62%)",
        }}
      />
      <div
        ref={fillRef}
        className="absolute left-0 top-0 size-[80vmax] will-change-transform"
        style={{
          background:
            "radial-gradient(circle at center, rgba(138,47,58,0.16) 0%, rgba(138,47,58,0.05) 35%, transparent 65%)",
        }}
      />
    </div>
  );
}
