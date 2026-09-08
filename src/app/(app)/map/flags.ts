/**
 * 나라 표시용 국기.
 *
 * 이모지 국기(🇬🇧 등)를 쓰면 **윈도우 크롬에서 "GB" 글자로 나와요.** 이모지 국기는
 * 지역 표시 문자 두 개(G+B)를 폰트가 합쳐 그리는 건데, 윈도우 기본 폰트에는 그
 * 그림이 없어서 글자가 그대로 보여요. 스코틀랜드 깃발은 아예 안 나오고요.
 *
 * 그래서 직접 그려요. 16px 에서도 알아볼 수 있게 아주 단순하게 잡았어요.
 * 지구본 핀은 React 밖(CSS2D)에서 만들어져서, 문자열과 컴포넌트 둘 다 필요해요.
 */

const VIEWBOX = '0 0 24 16';

/** 나라 → SVG 내부 요소 */
const SHAPES: Record<string, string> = {
  스코틀랜드:
    '<rect width="24" height="16" fill="#0065bd"/><path d="M0 0 L24 16 M24 0 L0 16" stroke="#fff" stroke-width="3.2"/>',
  "영국(잉글랜드)":
    '<rect width="24" height="16" fill="#fff"/><path d="M9.5 0h5v16h-5z M0 5.5h24v5H0z" fill="#cf142b"/>',
  영국:
    '<rect width="24" height="16" fill="#012169"/><path d="M0 0 L24 16 M24 0 L0 16" stroke="#fff" stroke-width="3.4"/><path d="M0 0 L24 16 M24 0 L0 16" stroke="#c8102e" stroke-width="1.8"/><path d="M12 0v16 M0 8h24" stroke="#fff" stroke-width="5"/><path d="M12 0v16 M0 8h24" stroke="#c8102e" stroke-width="3"/>',
  북아일랜드:
    '<rect width="24" height="16" fill="#fff"/><path d="M9.5 0h5v16h-5z M0 5.5h24v5H0z" fill="#cf142b"/><circle cx="12" cy="8" r="3.2" fill="#fff" stroke="#cf142b" stroke-width="0.8"/>',
  웨일스:
    '<rect width="24" height="8" fill="#fff"/><rect y="8" width="24" height="8" fill="#00ab39"/><path d="M8 5 q4-2 7 1 q-3 4-7 3z" fill="#c8102e"/>',
  아일랜드:
    '<rect width="8" height="16" fill="#169b62"/><rect x="8" width="8" height="16" fill="#fff"/><rect x="16" width="8" height="16" fill="#ff883e"/>',
  미국:
    '<rect width="24" height="16" fill="#fff"/><g fill="#b22234"><rect width="24" height="2.3"/><rect y="4.6" width="24" height="2.3"/><rect y="9.2" width="24" height="2.3"/><rect y="13.8" width="24" height="2.2"/></g><rect width="10" height="9.2" fill="#3c3b6e"/>',
  일본: '<rect width="24" height="16" fill="#fff"/><circle cx="12" cy="8" r="4.6" fill="#bc002d"/>',
  한국:
    '<rect width="24" height="16" fill="#fff"/><path d="M12 3.6a4.4 4.4 0 0 1 0 8.8 2.2 2.2 0 0 0 0-4.4 2.2 2.2 0 0 1 0-4.4z" fill="#cd2e3a"/><path d="M12 3.6a4.4 4.4 0 0 0 0 8.8 2.2 2.2 0 0 1 0-4.4 2.2 2.2 0 0 0 0-4.4z" fill="#0047a0"/>',
  대만:
    '<rect width="24" height="16" fill="#fe0000"/><rect width="12" height="8" fill="#000095"/><circle cx="6" cy="4" r="2.1" fill="#fff"/>',
  인도:
    '<rect width="24" height="5.33" fill="#ff9933"/><rect y="5.33" width="24" height="5.34" fill="#fff"/><rect y="10.67" width="24" height="5.33" fill="#138808"/><circle cx="12" cy="8" r="2" fill="none" stroke="#000080" stroke-width="0.8"/>',
  호주:
    '<rect width="24" height="16" fill="#00247d"/><rect width="11" height="8" fill="#012169"/><path d="M0 0 L11 8 M11 0 L0 8" stroke="#fff" stroke-width="1.6"/><path d="M5.5 0v8 M0 4h11" stroke="#fff" stroke-width="2.4"/><path d="M5.5 0v8 M0 4h11" stroke="#c8102e" stroke-width="1.2"/><circle cx="17" cy="11" r="1.5" fill="#fff"/>',
  캐나다:
    '<rect width="24" height="16" fill="#fff"/><rect width="6" height="16" fill="#d80621"/><rect x="18" width="6" height="16" fill="#d80621"/><path d="M12 4 l1.2 3 2.2-1 -1 2.6 2.6-.4 -2 1.8 .6 1.6 -2.4-.6 .2 2.6h-1l.2-2.6 -2.4 .6 .6-1.6 -2-1.8 2.6 .4 -1-2.6 2.2 1z" fill="#d80621"/>',
  프랑스:
    '<rect width="8" height="16" fill="#002395"/><rect x="8" width="8" height="16" fill="#fff"/><rect x="16" width="8" height="16" fill="#ed2939"/>',
  이탈리아:
    '<rect width="8" height="16" fill="#008c45"/><rect x="8" width="8" height="16" fill="#f4f5f0"/><rect x="16" width="8" height="16" fill="#cd212a"/>',
  스웨덴:
    '<rect width="24" height="16" fill="#006aa7"/><path d="M8 0v16 M0 8h24" stroke="#fecc00" stroke-width="3.2"/>',
  핀란드:
    '<rect width="24" height="16" fill="#fff"/><path d="M8.5 0v16 M0 8h24" stroke="#003580" stroke-width="3.4"/>',
  이스라엘:
    '<rect width="24" height="16" fill="#fff"/><rect y="2" width="24" height="2" fill="#0038b8"/><rect y="12" width="24" height="2" fill="#0038b8"/><path d="M12 5 l2.6 4.6h-5.2z M12 11 l-2.6-4.6h5.2z" fill="none" stroke="#0038b8" stroke-width="0.9"/>',
  독일:
    '<rect width="24" height="5.33" fill="#000"/><rect y="5.33" width="24" height="5.34" fill="#dd0000"/><rect y="10.67" width="24" height="5.33" fill="#ffce00"/>',
};

/** 나라를 모를 때 쓰는 잔 모양 */
const FALLBACK =
  '<rect width="24" height="16" rx="2" fill="#2a2118"/><path d="M9 4 h6 l-.8 7.2a1 1 0 0 1-1 .8h-2.4a1 1 0 0 1-1-.8z" fill="#f0a92b"/>';

/** 지구본 핀처럼 React 밖에서 만들 때 쓰는 SVG 문자열 */
export function flagSvg(country: string, size = 18): string {
  const shape = SHAPES[country] ?? FALLBACK;
  return (
    `<svg viewBox="${VIEWBOX}" width="${size}" height="${Math.round((size * 2) / 3)}" ` +
    `role="img" aria-label="${country} 국기" ` +
    `style="border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,0.25)">${shape}</svg>`
  );
}

export function hasFlag(country: string): boolean {
  return country in SHAPES;
}
