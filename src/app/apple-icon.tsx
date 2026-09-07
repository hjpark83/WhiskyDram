import { ImageResponse } from "next/og";

/**
 * iOS 홈 화면 아이콘. 아이폰은 SVG 를 안 받아서 여기서 PNG 로 그려요.
 * 모양은 src/app/icon.svg 와 같게 유지해주세요.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14110d",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
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
      </div>
    ),
    size,
  );
}
