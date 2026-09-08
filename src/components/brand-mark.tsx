import { BRAND } from "@/data/brand";
import { cn } from "@/lib/utils";

/**
 * 로고에 쓰는 위스키 잔.
 *
 * 예전엔 🥃 이모지를 썼는데, 이모지는 기기·브라우저마다 다른 그림으로 나와서
 * 파비콘과 안 맞고 조잡해 보였어요. 여기서 직접 그려요 — 모양은
 * `src/app/icon.svg`(파비콘) · `src/app/apple-icon.tsx` 와 같아야 해요.
 *
 * 크기는 글자에 맞춰 따라가요 (1.05em). 색은 어디서든 같게 보이도록 고정값이에요.
 */
export function GlassMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-[1.05em] w-[1.05em] shrink-0", className)}
      role="img"
      aria-label="위스키 잔"
    >
      <path d="M19.1 32 L21 47 A3 3 0 0 0 24 50 L40 50 A3 3 0 0 0 43 47 L44.9 32 Z" fill="#f0a92b" />
      <path
        d="M17 16 L21 47 A3 3 0 0 0 24 50 L40 50 A3 3 0 0 0 43 47 L47 16 Z"
        fill="none"
        stroke="#f5d18a"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path d="M20.4 33.4 L43.6 33.4" stroke="#ffe6b0" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

/** 잔 + 이름. 헤더·로그인·랜딩·공유에서 같은 모양으로 써요. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <GlassMark />
      <span>{BRAND.name}</span>
    </span>
  );
}
