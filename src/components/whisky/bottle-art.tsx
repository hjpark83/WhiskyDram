import { liquidColor } from "@/lib/whisky/format";
import { cn } from "@/lib/utils";
import type { Whisky } from "@/lib/whisky/types";

/**
 * 병 그림.
 *
 * 실물 사진을 쓰지 않는 이유: 브랜드 제품 사진은 **저작권이 있어요**. 긁어 쓰면
 * 안 되고, AI 로 만들면 라벨을 틀리게 그려서 "대조" 라는 목적에 오히려 해로워요.
 *
 * 대신 우리가 이미 가진 정보로 그려요:
 *  - 액체 색: `liquidColor()` 가 숙성 연수·통 종류·분류로 계산해요
 *  - 병 모양: 종류별 실루엣 (스카치 몰트 / 버번 / 아이리시 / 일본)
 *  - 라벨: 한글 이름 첫 글자
 *
 * 실물은 아니지만 목록에서 훑을 때 **셰리 진한 병과 버번 가벼운 병이 눈에 바로
 * 들어와요.** 나중에 사용자가 찍은 사진이 쌓이면 그걸 먼저 보여주면 돼요.
 */

type Silhouette = "malt" | "bourbon" | "irish" | "japanese" | "squat";

function silhouetteFor(w: Whisky): Silhouette {
  if (w.type === "bourbon" || w.type === "rye") return "bourbon";
  if (w.type === "japanese") return "japanese";
  if (w.type === "irish") return "irish";
  // 셰리를 많이 쓴 병은 통통한 모양이 많아요 (맥캘란·글렌드로낙 계열)
  if (w.styles.includes("sherry")) return "squat";
  return "malt";
}

/** 병 바깥 윤곽 (viewBox 0 0 40 100) */
const OUTLINE: Record<Silhouette, string> = {
  malt: "M15 6 h10 v3 q0 3 2.5 6 Q31 21 31 28 v58 q0 5 -5 5 h-12 q-5 0 -5 -5 V28 q0 -7 3.5 -13 Q15 12 15 9 z",
  squat: "M14 6 h12 v4 q0 3 3 6 Q33 22 33 32 v54 q0 5 -5 5 h-16 q-5 0 -5 -5 V32 q0 -10 4 -16 Q14 13 14 10 z",
  bourbon: "M13 6 h14 v6 q0 2 2 4 Q32 20 32 26 v60 q0 5 -5 5 h-14 q-5 0 -5 -5 V26 q0 -6 3 -10 q2 -2 2 -4 z",
  irish: "M16 6 h8 v5 q0 3 3 7 Q31 24 31 31 v55 q0 5 -5 5 h-12 q-5 0 -5 -5 V31 q0 -7 4 -13 q3 -4 3 -7 z",
  japanese: "M14 6 h12 v4 q0 4 2 7 Q31 22 31 30 v56 q0 5 -5 5 h-12 q-5 0 -5 -5 V30 q0 -8 3 -13 Q14 14 14 10 z",
};

/** 액체가 차오르는 높이 (y 좌표) — 도수가 높을수록 조금 더 차게 */
function liquidTop(w: Whisky): number {
  const base = 44;
  return Math.round(base - Math.min(8, Math.max(0, (w.abv - 40) / 2.5)));
}

export function BottleArt({
  whisky,
  className,
  showLabel = true,
}: {
  whisky: Whisky;
  className?: string;
  /** 작은 자리에서는 라벨 글자를 빼요 */
  showLabel?: boolean;
}) {
  const { hex } = liquidColor(whisky);
  const shape = silhouetteFor(whisky);
  const path = OUTLINE[shape];
  const top = liquidTop(whisky);
  const id = `bottle-${whisky.id}`;

  return (
    <svg
      viewBox="0 0 40 100"
      className={cn("h-full w-auto", className)}
      role="img"
      aria-label={`${whisky.nameKo} 병 그림`}
    >
      <defs>
        {/* 병 안쪽만 액체가 보이게 잘라내요 */}
        <clipPath id={`${id}-clip`}>
          <path d={path} />
        </clipPath>
        <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={hex} stopOpacity="0.75" />
          <stop offset="45%" stopColor={hex} />
          <stop offset="100%" stopColor={hex} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* 유리 */}
      <path d={path} fill="#1c1712" />

      <g clipPath={`url(#${id}-clip)`}>
        {/* 액체 */}
        <rect x="0" y={top} width="40" height={100 - top} fill={`url(#${id}-liquid)`} />
        {/* 표면에 비치는 선 */}
        <rect x="0" y={top} width="40" height="1.2" fill="#fff" opacity="0.35" />
        {/* 유리 반사 */}
        <rect x="0" y="0" width="40" height="100" fill={`url(#${id}-glass)`} />
        {/* 라벨 */}
        <rect x="7" y="52" width="26" height="22" rx="1.5" fill="#f3e7d3" opacity="0.93" />
        {showLabel && (
          <text
            x="20"
            y="66"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#4a3520"
          >
            {whisky.nameKo.slice(0, 1)}
          </text>
        )}
      </g>

      {/* 병 윤곽선 */}
      <path d={path} fill="none" stroke="#e8cf9a" strokeOpacity="0.45" strokeWidth="1.4" />
      {/* 마개 */}
      <rect x="14.5" y="2" width="11" height="5" rx="1" fill="#3a2c1c" stroke="#e8cf9a" strokeOpacity="0.4" strokeWidth="1" />
    </svg>
  );
}
