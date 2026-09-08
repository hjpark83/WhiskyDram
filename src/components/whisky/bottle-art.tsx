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
 *  - 라벨: 증류소 이름(영문) + 숙성 연수 숫자
 *
 * 처음엔 한글 이름을 넣었더니 라벨 폭에 **한 글자만** 들어가서 허전했어요
 * ("라가불린" → "라"). 실제 라벨도 영문이고, 영문은 같은 폭에 이름이 통째로
 * 들어가요. 그래서 `distillery` 를 쓰고 길면 두 줄로 나눠요.
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

/**
 * 병 바깥 윤곽 (viewBox 0 0 40 100).
 *
 * 처음엔 목을 길고 가늘게 그렸더니 **생수 페트병처럼** 보였어요. 위스키 병은
 * 목이 짧고 굵으며 어깨가 넓게 벌어져요. 그 비율(목 8 : 몸통 28)이 핵심이에요.
 */
const OUTLINE: Record<Silhouette, string> = {
  // 스카치 몰트 — 둥근 어깨
  malt: "M16 8 h8 v13 q0 3 3.5 5.5 Q34 32 34 40 v48 q0 4 -4 4 h-20 q-4 0 -4 -4 V40 q0 -8 6.5 -13.5 Q16 24 16 21 z",
  // 셰리 계열 — 어깨가 더 넓고 통통해요
  squat: "M15.5 8 h9 v12 q0 3.5 4.5 6 Q36 32 36 40 v48 q0 4 -4 4 h-24 q-4 0 -4 -4 V40 q0 -8 7 -14 Q15.5 23.5 15.5 20 z",
  // 버번 — 어깨가 각지고 몸통이 조금 짧아요
  bourbon: "M15.5 8 h9 v12 l2 3 q6.5 4 6.5 11 v44 q0 4 -4 4 h-18 q-4 0 -4 -4 V34 q0 -7 6.5 -11 l2 -3 z",
  // 아이리시 — 목이 조금 길고 몸통이 갸름해요
  irish: "M16.5 8 h7 v15 q0 3 3 5 Q33 34 33 42 v46 q0 4 -4 4 h-18 q-4 0 -4 -4 V42 q0 -8 6.5 -14 Q16.5 26 16.5 23 z",
  // 일본 — 직선적인 어깨
  japanese: "M16 8 h8 v13 q0 3 3 5 l6 5 q1 2 1 5 v52 q0 4 -4 4 h-20 q-4 0 -4 -4 V36 q0 -3 1 -5 l6 -5 q3 -2 3 -5 z",
};

/**
 * 액체가 차오르는 높이 (y).
 * 실제 병은 어깨 바로 아래까지 차 있어요. 예전엔 절반만 채워서 빈 병처럼 보였어요.
 */
function liquidTop(w: Whisky): number {
  return Math.round(Math.min(34, Math.max(27, 31 - (w.abv - 43) / 4)));
}


/**
 * 라벨에 넣을 이름을 최대 2줄로 나눠요.
 *
 * `distillery` 대신 영문 `name` 을 쓰는 이유: 블렌디드는 증류소 칸이 회사
 * 이름이라 라벨과 달라요 (몽키 숄더 → "William Grant & Sons"). 실제 라벨에
 * 크게 박히는 건 브랜드 이름이라, 이름에서 숙성 연수 숫자 뒤를 잘라내요
 * ("Redbreast 12 Year Old" → "REDBREAST").
 */
const LABEL_WIDTH = 21.5;
/** Georgia 대문자 한 글자의 대략적인 폭 (fontSize 대비) */
const CHAR_W = 0.68;

function brandOf(w: Whisky): string {
  const words = w.name.split(/\s+/).filter(Boolean);
  const numAt = words.findIndex((t) => /^\d/.test(t));
  const head = numAt > 0 ? words.slice(0, numAt) : words;
  return head.join(" ").trim() || w.name;
}

function labelName(w: Whisky): { lines: string[]; size: number } {
  const brand = brandOf(w);
  const words = brand.split(" ");

  let lines = [brand];
  if (words.length > 1 && brand.length > 11) {
    // 두 줄 길이가 가장 비슷해지는 지점에서 끊어요
    let cut = 1;
    let best = Infinity;
    for (let i = 1; i < words.length; i += 1) {
      const diff = Math.abs(
        words.slice(0, i).join(" ").length - words.slice(i).join(" ").length,
      );
      if (diff < best) {
        best = diff;
        cut = i;
      }
    }
    lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
  }

  const longest = Math.max(...lines.map((l) => l.length));
  return { lines, size: Math.min(4.2, LABEL_WIDTH / (longest * CHAR_W)) };
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
  const name = labelName(whisky);

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

        {/* 목 라벨 — 실제 병처럼 어깨 위에 얇은 띠가 하나 */}
        <rect x="16" y="12" width="8" height="4" fill="#f3e7d3" opacity="0.8" />

        {/* 본 라벨 */}
        <rect x="8" y="54" width="24" height="26" rx="1.2" fill="#f3e7d3" opacity="0.95" />
        <rect x="8" y="54" width="24" height="26" rx="1.2" fill="none" stroke="#8a6b34" strokeOpacity="0.4" strokeWidth="0.5" />
        {showLabel && (
          <>
            {/* 브랜드 이름 — 실제 라벨처럼 영문 대문자로 */}
            {name.lines.map((line, i) => (
              <text
                key={line}
                x="20"
                y={59.6 + i * (name.size + 0.6)}
                textAnchor="middle"
                fontSize={name.size}
                fontWeight="600"
                textLength={Math.min(LABEL_WIDTH, line.length * name.size * CHAR_W)}
                lengthAdjust="spacingAndGlyphs"
                fill="#5a3f1c"
                fontFamily="Georgia, 'Times New Roman', serif"
              >
                {line.toUpperCase()}
              </text>
            ))}

            {/* 이름과 숫자 사이 가는 선 */}
            <rect x="13" y={62.4 + (name.lines.length - 1) * 3} width="14" height="0.5" fill="#8a6b34" opacity="0.45" />

            {/* 숙성 연수 — 실제 라벨에서도 멀리서 보이는 건 이 숫자예요 */}
            {whisky.age !== null ? (
              <>
                <text
                  x="20"
                  y="73"
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  fill="#5a3f1c"
                  fontFamily="Georgia, 'Times New Roman', serif"
                >
                  {whisky.age}
                </text>
                <text x="20" y="77.4" textAnchor="middle" fontSize="2.6" letterSpacing="0.35" fill="#8a6b34" fontFamily="Georgia, 'Times New Roman', serif">
                  YEARS
                </text>
              </>
            ) : (
              <>
                {/* 숙성 연수를 안 적는 병(NAS) 은 마름모 장식과 도수로 */}
                <path d="M20 67 l2.6 3 -2.6 3 -2.6 -3z" fill="#8a6b34" opacity="0.5" />
                <text x="20" y="77.4" textAnchor="middle" fontSize="2.8" letterSpacing="0.3" fill="#8a6b34" fontFamily="Georgia, 'Times New Roman', serif">
                  {whisky.abv.toFixed(1)}% ABV
                </text>
              </>
            )}
          </>
        )}
      </g>

      {/* 병 윤곽선 */}
      <path d={path} fill="none" stroke="#e8cf9a" strokeOpacity="0.45" strokeWidth="1.4" />
      {/* 마개 */}
      <rect x="14.5" y="1.5" width="11" height="7" rx="1.2" fill="#3a2c1c" stroke="#e8cf9a" strokeOpacity="0.45" strokeWidth="1.1" />
    </svg>
  );
}
