import type { Whisky } from "@/lib/whisky/types";

/**
 * 라벨에 넣을 이름을 최대 2줄로 나눠요.
 *
 * `distillery` 대신 영문 `name` 을 쓰는 이유: 블렌디드는 증류소 칸이 회사
 * 이름이라 라벨과 달라요 (몽키 숄더 → "William Grant & Sons"). 실제 라벨에
 * 크게 박히는 건 브랜드 이름이라, 이름에서 숙성 연수 숫자 뒤를 잘라내요
 * ("Redbreast 12 Year Old" → "REDBREAST").
 */
export const LABEL_WIDTH = 21.5;
/** Georgia 대문자 한 글자의 대략적인 폭 (fontSize 대비) */
export const CHAR_W = 0.68;

export function brandOf(w: Whisky): string {
  const words = w.name.split(/\s+/).filter(Boolean);
  const numAt = words.findIndex((t) => /^\d/.test(t));
  const head = numAt > 0 ? words.slice(0, numAt) : words;
  return head.join(" ").trim() || w.name;
}

export function labelName(w: Whisky): { lines: string[]; size: number } {
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

