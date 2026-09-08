/**
 * 위키미디어 커먼즈에서 병 사진 찾기.
 *
 * ## 왜 커먼즈인가
 *
 * 판매 사이트 제품 이미지는 수입사·유통사 자산이라 못 써요. 커먼즈에 올라온
 * 사진 중에는 **자유 라이선스**(CC BY / CC BY-SA / CC0 / 퍼블릭 도메인)라
 * 출처만 밝히면 합법적으로 쓸 수 있는 것들이 있어요.
 *
 * ## 지켜야 하는 것
 *
 * 라이선스가 공짜로 쓰라는 게 아니라 **조건부**예요. 촬영자·라이선스 이름·
 * 원본 링크를 같이 보여줘야 해요. 그래서 검색 결과에 그 정보를 같이 담고,
 * 없으면 아예 후보에서 빼요 (`usable`).
 *
 * ## 사람이 반드시 확인해야 해요
 *
 * 커먼즈 검색은 이름만 맞으면 엉뚱한 사진(다른 병, 잔, 증류소 건물)도 걸려요.
 * 게다가 병 사진은 라벨 도안이 함께 찍혀서, 자유 라이선스라도 애매한 경우가
 * 있어요. 그래서 자동으로 붙이지 않고 **관리자가 눈으로 보고 고르게** 해요.
 */

/** 가짜 서버로 테스트할 때 바꿔 끼워요 (scripts/mock-commons.mjs) */
const API = process.env.COMMONS_API_URL ?? "https://commons.wikimedia.org/w/api.php";

/** 커먼즈가 요구하는 예의 — 누가 부르는지 밝혀요 */
const UA = "Whiskipedia/1.0 (hackathon project; contact via GitHub hjpark83/WhiskyDram)";

export interface CommonsPhoto {
  /** File:xxx.jpg */
  title: string;
  /** 목록에 보여줄 작은 그림 */
  thumbUrl: string;
  /** 실제로 화면에 쓸 그림 */
  imageUrl: string;
  /** 커먼즈 파일 설명 페이지 (출처 링크) */
  sourceUrl: string;
  /** 촬영자 (HTML 태그를 걷어낸 글자) */
  credit: string;
  /** 예: "CC BY-SA 4.0" */
  license: string;
  /**
   * 쓸 수 있는 라이선스인지. 라이선스를 못 읽었거나 자유 라이선스가 아니면
   * false 예요 — 화면에서 고를 수 없게 막아요.
   */
  usable: boolean;
}

/** 자유 라이선스로 인정할 것들. 모르는 건 안 쓰는 쪽이 안전해요. */
const FREE = [/^cc0/i, /^cc[- ]by/i, /^public domain/i, /^pd/i];

function isFree(license: string): boolean {
  const l = license.trim();
  if (!l) return false;
  // NC(비상업), ND(변경 금지)는 이 서비스에서 쓰기 어려워요
  if (/\bnc\b/i.test(l) || /\bnd\b/i.test(l)) return false;
  return FREE.some((re) => re.test(l));
}

/** extmetadata 값은 HTML 이 섞여 있어요 (<a href=...>이름</a>) */
function plain(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ApiPage {
  title?: string;
  imageinfo?: {
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

/**
 * 병 이름으로 커먼즈를 검색해요.
 *
 * 실패해도 던지지 않고 빈 배열을 돌려줘요 — 사진을 못 찾은 것과 화면이
 * 깨지는 건 다른 일이니까요.
 */
export async function searchCommons(query: string, limit = 12): Promise<CommonsPhoto[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} bottle`,
    gsrnamespace: "6", // File:
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "320",
  });

  let json: { query?: { pages?: Record<string, ApiPage> } };
  try {
    const res = await fetch(`${API}?${params}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      // 사진 목록은 자주 안 바뀌어요
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`[commons] 검색 실패 HTTP ${res.status}`);
      return [];
    }
    json = await res.json();
  } catch (error) {
    console.error("[commons] 검색 실패", error);
    return [];
  }

  const pages = Object.values(json.query?.pages ?? {});
  const out: CommonsPhoto[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.url || !page.title) continue;
    const meta = info.extmetadata ?? {};
    const license = plain(meta.LicenseShortName?.value);
    out.push({
      title: page.title,
      thumbUrl: info.thumburl ?? info.url,
      imageUrl: info.url,
      sourceUrl:
        info.descriptionurl ??
        `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      credit: plain(meta.Artist?.value) || "알 수 없음",
      license: license || "알 수 없음",
      usable: isFree(license),
    });
  }
  // 쓸 수 있는 것부터 보여줘요
  return out.sort((a, b) => Number(b.usable) - Number(a.usable));
}

/** 출처 표기 한 줄 — 라이선스가 요구하는 최소한이에요 */
export function creditLine(p: { credit: string | null; license: string | null }): string {
  const who = p.credit?.trim() || "촬영자 미상";
  const lic = p.license?.trim() || "라이선스 미상";
  return `${who} · ${lic} · 위키미디어 커먼즈`;
}
