import { cn } from "@/lib/utils";

/**
 * 조명 아래 위스키가 찰랑이는 락 글라스 (순수 SVG + CSS 애니메이션).
 * - size: 픽셀 폭. 높이는 비율에 맞춰요.
 * - light: 위쪽 스포트라이트 원뿔을 함께 그릴지.
 */
export function WhiskyGlass({
  size = 220,
  light = true,
  className,
}: {
  size?: number;
  light?: boolean;
  className?: string;
}) {
  const h = Math.round(size * 1.15);
  return (
    <div className={cn("relative inline-block select-none", className)} style={{ width: size, height: h }} aria-hidden>
      {light && (
        <>
          {/* 스포트라이트 원뿔 */}
          <div
            className="glass-light absolute left-1/2 top-[-40%] h-[150%] w-[140%] -translate-x-1/2"
            style={{
              background:
                "radial-gradient(ellipse 45% 55% at 50% 30%, rgba(255,214,130,0.28), rgba(217,164,65,0.08) 45%, transparent 70%)",
            }}
          />
          {/* 바닥 반사 */}
          <div
            className="absolute bottom-[2%] left-1/2 h-[10%] w-[70%] -translate-x-1/2 rounded-[100%] blur-md"
            style={{ background: "rgba(217,164,65,0.25)" }}
          />
        </>
      )}
      <svg viewBox="0 0 200 230" width={size} height={h} className="relative">
        <defs>
          <clipPath id="wg-inner">
            <path d="M46 34 H154 L146 206 Q145 214 137 214 H63 Q55 214 54 206 Z" />
          </clipPath>
          <linearGradient id="wg-liquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f1b64a" />
            <stop offset="0.55" stopColor="#c9791c" />
            <stop offset="1" stopColor="#7a3f0c" />
          </linearGradient>
          <linearGradient id="wg-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.10)" />
          </linearGradient>
          <linearGradient id="wg-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="wg-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        {/* 잔 몸통 (뒤) */}
        <path
          d="M40 26 H160 L150 210 Q149 222 137 222 H63 Q51 222 50 210 Z"
          fill="url(#wg-glass)"
          stroke="rgba(243,231,211,0.35)"
          strokeWidth="1.5"
        />

        {/* 액체: 잔 안쪽으로 클립, 전체가 좌우로 살짝 기울며 찰랑 */}
        <g clipPath="url(#wg-inner)">
          <g className="glass-slosh" style={{ transformOrigin: "100px 214px" }}>
            {/* 물결 면: 넓게 만들어 좌우로 흘려요 */}
            <g className="glass-wave">
              <path
                d="M-200 122 Q-150 114 -100 122 T0 122 T100 122 T200 122 T300 122 T400 122 V260 H-200 Z"
                fill="url(#wg-liquid)"
              />
              {/* 수면 하이라이트 */}
              <path
                d="M-200 122 Q-150 114 -100 122 T0 122 T100 122 T200 122 T300 122 T400 122"
                fill="none"
                stroke="rgba(255,230,170,0.7)"
                strokeWidth="2"
              />
            </g>
            {/* 얼음 */}
            <g className="glass-ice" style={{ transformOrigin: "100px 150px" }}>
              <rect x="74" y="128" width="44" height="42" rx="7" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
              <path d="M80 134 L112 164" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              <path d="M84 162 L108 136" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </g>
            {/* 액체 속 빛 번짐 */}
            <ellipse cx="128" cy="150" rx="18" ry="30" fill="rgba(255,210,120,0.22)" filter="url(#wg-blur)" />
          </g>
        </g>

        {/* 잔 몸통 (앞 유리) */}
        <path
          d="M40 26 H160 L150 210 Q149 222 137 222 H63 Q51 222 50 210 Z"
          fill="none"
          stroke="rgba(243,231,211,0.5)"
          strokeWidth="1.5"
        />
        {/* 잔 입구 타원 */}
        <ellipse cx="100" cy="26" rx="60" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(243,231,211,0.55)" strokeWidth="1.5" />
        {/* 두꺼운 바닥 */}
        <path d="M54 196 H146 L150 210 Q149 222 137 222 H63 Q51 222 50 210 Z" fill="rgba(255,255,255,0.08)" />

        {/* 유리 반짝임 */}
        <path className="glass-glint" d="M52 44 L58 150" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round" />
        <path className="glass-glint glass-glint-2" d="M140 60 L136 120" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" />

        {/* 조명 스윕 */}
        <g clipPath="url(#wg-inner)">
          <rect className="glass-sweep" x="-60" y="20" width="60" height="220" fill="url(#wg-sweep)" transform="skewX(-15)" />
        </g>
      </svg>
    </div>
  );
}
