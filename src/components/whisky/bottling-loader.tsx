"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * AI 분석 중 로딩: 캐스크에서 원액을 뽑아 병에 담고, 라벨을 붙여 한 병을 완성해요.
 * - done=false 동안은 90% 근처까지 천천히 차오르고
 * - done=true 가 되면 끝까지 채우고 코르크·라벨이 붙으며 "완성"
 * - onComplete 는 완성 연출이 끝난 뒤 한 번 호출돼요 (페이지 이동 타이밍용)
 */
export function BottlingLoader({
  done = false,
  lines,
  onComplete,
  className,
}: {
  done?: boolean;
  lines?: string[];
  onComplete?: () => void;
  className?: string;
}) {
  const [p, setP] = useState(0);
  const start = useRef<number | null>(null);
  const doneAt = useRef<number | null>(null);
  const pAtDone = useRef(0);
  const completed = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (start.current === null) start.current = now;
      const t = (now - start.current) / 1000;
      let next: number;
      if (done) {
        if (doneAt.current === null) {
          doneAt.current = now;
          pAtDone.current = Math.min(0.9, 1 - Math.exp(-t / 7));
        }
        const k = Math.min(1, (now - doneAt.current) / 700);
        const ease = 1 - Math.pow(1 - k, 3);
        next = pAtDone.current + (1 - pAtDone.current) * ease;
        if (k >= 1 && !completed.current) {
          completed.current = true;
          window.setTimeout(() => onComplete?.(), 650);
        }
      } else {
        next = Math.min(0.9, 1 - Math.exp(-t / 7));
      }
      setP(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, onComplete]);

  const finished = done && p >= 0.999;
  const stages = lines ?? ["캐스크에서 원액을 뽑는 중…", "병에 담는 중…", "라벨을 붙이는 중…"];
  const stageIdx = finished ? -1 : p < 0.35 ? 0 : p < 0.75 ? 1 : 2;
  const stageText = finished ? "한 병 완성! 결과로 이동해요" : stages[Math.min(stageIdx, stages.length - 1)];

  // 병 안 액체: 바닥 y=186 에서 목 아래 y=112 까지
  const bottleTop = 112;
  const bottleBottom = 186;
  const liquidY = bottleBottom - (bottleBottom - bottleTop) * p;
  const labelOpacity = Math.max(0, Math.min(1, (p - 0.55) / 0.3));
  const pouring = !finished;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)} aria-live="polite">
      <svg viewBox="0 0 320 200" width={320} height={200} className="max-w-full" aria-hidden>
        <defs>
          <linearGradient id="bl-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a5a2b" />
            <stop offset="0.5" stopColor="#6b4220" />
            <stop offset="1" stopColor="#4a2c15" />
          </linearGradient>
          <linearGradient id="bl-liquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2b64c" />
            <stop offset="1" stopColor="#b8621a" />
          </linearGradient>
          <linearGradient id="bl-glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
          </linearGradient>
          <clipPath id="bl-bottle-clip">
            <path d="M232 100 H246 V118 Q246 124 252 128 L262 136 Q264 138 264 142 V180 Q264 188 256 188 H222 Q214 188 214 180 V142 Q214 138 216 136 L226 128 Q232 124 232 118 Z" />
          </clipPath>
        </defs>

        {/* 받침대 */}
        <path d="M30 118 L46 100 H132 L148 118 Z" fill="#2e2117" stroke="rgba(217,164,65,0.35)" />
        <rect x="24" y="118" width="130" height="6" rx="2" fill="#3a2a1c" />

        {/* 캐스크 */}
        <g>
          <rect x="34" y="30" width="112" height="74" rx="22" fill="url(#bl-wood)" stroke="rgba(0,0,0,0.35)" />
          <rect x="34" y="30" width="112" height="74" rx="22" fill="none" stroke="rgba(255,220,150,0.18)" />
          {[52, 90, 128].map((x) => (
            <rect key={x} x={x - 4} y="28" width="8" height="78" rx="2" fill="#c9a24f" opacity="0.9" />
          ))}
          <ellipse cx="146" cy="67" rx="6" ry="37" fill="#5a3418" stroke="rgba(0,0,0,0.35)" />
          {/* 꼭지 */}
          <rect x="146" y="82" width="14" height="8" rx="2" fill="#c9a24f" />
          <rect x="157" y="79" width="5" height="14" rx="1.5" fill="#e0bd66" />
        </g>

        {/* 파이프: 꼭지 → 병 위 */}
        <path d="M162 86 H239 V98" fill="none" stroke="#8a6b34" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M162 86 H239 V98" fill="none" stroke="#3a2a1c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {pouring && (
          <path
            d="M162 86 H239 V98"
            fill="none"
            stroke="#f0a83a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 8"
            className="bl-flow"
          />
        )}
        {/* 병 속으로 떨어지는 줄기 */}
        {pouring && (
          <path
            d={`M239 100 V${Math.max(liquidY, 104)}`}
            stroke="#f0a83a"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="bl-stream"
          />
        )}

        {/* 병 */}
        <g>
          <g clipPath="url(#bl-bottle-clip)">
            <rect x="210" y={liquidY} width="60" height={200 - liquidY} fill="url(#bl-liquid)" />
            {pouring && (
              <ellipse cx="239" cy={liquidY} rx="24" ry="2.5" fill="rgba(255,230,170,0.5)" className="bl-surface" />
            )}
          </g>
          <path
            d="M232 100 H246 V118 Q246 124 252 128 L262 136 Q264 138 264 142 V180 Q264 188 256 188 H222 Q214 188 214 180 V142 Q214 138 216 136 L226 128 Q232 124 232 118 Z"
            fill="url(#bl-glass)"
            stroke="rgba(243,231,211,0.6)"
            strokeWidth="1.5"
          />
          <path d="M219 140 V178" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
          {/* 라벨 */}
          <g opacity={labelOpacity}>
            <rect x="221" y="148" width="36" height="24" rx="2" fill="#f3e7d3" stroke="#c9a24f" />
            <text x="239" y="158" textAnchor="middle" fontSize="6" fontWeight="700" fill="#5a341a" fontFamily="serif">
              FirstDram
            </text>
            <text x="239" y="167" textAnchor="middle" fontSize="5" fill="#8a6b34">
              {finished ? "SINGLE PICK" : "···"}
            </text>
          </g>
          {/* 코르크 */}
          <g className={cn("transition-transform duration-500", finished ? "translate-y-0" : "-translate-y-6 opacity-0")}>
            <rect x="233" y="92" width="12" height="10" rx="2" fill="#b98a55" stroke="#7a5a30" />
          </g>
          {finished && <circle cx="239" cy="140" r="26" fill="none" stroke="rgba(217,164,65,0.7)" className="bl-ring" />}
        </g>
      </svg>

      <div className="text-center">
        <p className="text-lg font-semibold">{stageText}</p>
        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{Math.round(p * 100)}%</p>
      </div>
    </div>
  );
}
