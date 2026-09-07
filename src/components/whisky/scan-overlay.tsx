import type { ScanRegion } from "@/lib/ai/scan";

/**
 * 사진 위에 "여기서 이걸 읽었어요" 를 그려줘요.
 *
 * 좌표는 사진의 세로·가로를 각각 0~1000 으로 본 값이라, 이미지 위에 정확히
 * 겹치려면 SVG 가 **이미지 요소와 똑같은 사각형**이어야 해요. 그래서 바깥을
 * inline-block 으로 두어 이미지 크기에 딱 맞게 감싸고, viewBox 를 늘여 붙여요
 * (preserveAspectRatio="none").
 *
 * 박스는 하나씩 차례로 떠요 — 한꺼번에 나오면 뭘 읽었는지 눈이 못 따라가요.
 * 순서는 상태나 타이머 없이 CSS animation-delay 로만 냅니다 (서버 컴포넌트로도
 * 쓸 수 있고, 리렌더가 없어요).
 */

const KIND_LABELS: Record<ScanRegion["kind"], string> = {
  brand: "브랜드",
  age: "숙성 연수",
  edition: "에디션",
  abv: "도수",
  origin: "원산지",
  other: "읽은 글자",
};

/** i번째 박스가 뜨는 시각 */
function delayFor(i: number): string {
  return `${350 + i * 450}ms`;
}

export function ScanOverlay({
  src,
  regions,
  scanning,
}: {
  src: string;
  regions: ScanRegion[];
  /** 읽는 중이면 스캔선이 지나가요 */
  scanning?: boolean;
}) {
  return (
    <div className="flex justify-center">
      <div className="relative inline-block overflow-hidden rounded-xl">
        {/* 사용자가 방금 고른 사진이라 next/image 최적화를 안 거쳐요 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="스캔한 병 사진" className="block max-h-[60vh] w-auto max-w-full" />

        {scanning && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-1/3 animate-[scanSweep_1.6s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-amber-300/25 to-transparent"
          />
        )}

        {regions.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            aria-hidden
          >
            {regions.map((r, i) => {
              const [ymin, xmin, ymax, xmax] = r.box;
              return (
                <rect
                  key={`${r.kind}-${i}`}
                  x={xmin}
                  y={ymin}
                  width={xmax - xmin}
                  height={ymax - ymin}
                  fill="rgba(251,191,36,0.10)"
                  stroke="rgb(251,191,36)"
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                  rx={6}
                  className="animate-[boxIn_320ms_ease-out_both]"
                  style={{ animationDelay: delayFor(i) }}
                />
              );
            })}
          </svg>
        )}

        {/*
          글자는 SVG 밖에 둬요 — viewBox 를 늘여 붙이면(preserveAspectRatio="none")
          글자도 같이 찌그러져요. 박스 **안쪽 위**에 붙여서 사진 밖으로 잘리지 않게 해요.
        */}
        {regions.map((r, i) => {
          const [ymin, xmin, , xmax] = r.box;
          return (
            <span
              key={`label-${r.kind}-${i}`}
              className="pointer-events-none absolute"
              style={{
                left: `${xmin / 10}%`,
                top: `${ymin / 10}%`,
                maxWidth: `${Math.max(24, (xmax - xmin) / 10)}%`,
              }}
            >
              <span
                className="animate-[boxIn_320ms_ease-out_both] block truncate rounded-md rounded-tl-none bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-950 shadow"
                style={{ animationDelay: delayFor(i) }}
              >
                {KIND_LABELS[r.kind]}
                {r.text ? ` · ${r.text}` : ""}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function scanRegionLabel(kind: ScanRegion["kind"]): string {
  return KIND_LABELS[kind];
}
