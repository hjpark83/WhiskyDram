import { flagSvg } from "./flags";

/** 국기 아이콘 (React 쪽). 지구본 핀은 flagSvg() 문자열을 써요. */
export function Flag({ country, size = 16 }: { country: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 align-[-2px]"
      // 같은 그림을 두 곳에서 쓰려고 문자열을 공유해요 (여기 들어오는 값은 우리가 만든 SVG 예요)
      dangerouslySetInnerHTML={{ __html: flagSvg(country, size) }}
    />
  );
}
