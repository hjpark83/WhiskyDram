import type { PopupLink, PopupStore } from "@/data/popups";

export type PopupStatus = "ongoing" | "upcoming" | "ended";

export const STATUS_LABELS_KO: Record<PopupStatus, string> = {
  ongoing: "진행 중",
  upcoming: "오픈 예정",
  ended: "종료",
};

/** 날짜만 비교해요 (시간대 때문에 하루 밀리지 않게 로컬 자정으로 맞춰요) */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

function todayNumber(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000;
}

export function popupStatus(p: Pick<PopupStore, "startDate" | "endDate">, now = new Date()): PopupStatus {
  const today = todayNumber(now);
  if (today < dayNumber(p.startDate)) return "upcoming";
  if (today > dayNumber(p.endDate)) return "ended";
  return "ongoing";
}

/**
 * 남은 날짜.
 * - 진행 중: 종료까지 며칠 (0이면 오늘 마지막)
 * - 오픈 예정: 시작까지 며칠
 * - 종료: null
 */
export function daysLeft(p: Pick<PopupStore, "startDate" | "endDate">, now = new Date()): number | null {
  const today = todayNumber(now);
  const status = popupStatus(p, now);
  if (status === "ended") return null;
  if (status === "upcoming") return dayNumber(p.startDate) - today;
  return dayNumber(p.endDate) - today;
}

export function statusNote(p: Pick<PopupStore, "startDate" | "endDate">, now = new Date()): string {
  const status = popupStatus(p, now);
  const left = daysLeft(p, now);
  if (status === "ended") return "종료된 팝업";
  if (status === "upcoming") return left === 0 ? "내일 오픈" : `${left}일 뒤 오픈`;
  return left === 0 ? "오늘 마지막" : `${left}일 남음`;
}

/** 2026-08-20 → 8월 20일 */
export function formatDateKo(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

export function formatPeriod(p: Pick<PopupStore, "startDate" | "endDate">): string {
  return `${formatDateKo(p.startDate)} – ${formatDateKo(p.endDate)}`;
}

/**
 * 네이버 검색 링크. 팝업 정보는 네이버 블로그·플레이스에 가장 빨리 올라오니
 * 관리자가 상세 링크를 안 넣었을 때의 기본 통로로 써요.
 */
export function naverSearchUrl(query: string): string {
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}

/** 네이버 지도 검색 (장소 찾아가기) */
export function naverMapUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

/** 인스타그램 해시태그 (브랜드 팝업은 태그로 후기가 가장 많아요) */
export function instagramTagUrl(tag: string): string {
  return `https://www.instagram.com/explore/tags/${encodeURIComponent(tag.replace(/[^0-9a-zA-Z가-힣]/g, ""))}/`;
}

/**
 * 화면에 띄울 링크 목록.
 *
 * ## 검색 링크를 함부로 만들지 않아요
 *
 * 예전엔 팝업마다 「네이버에서 정보 찾기」를 **무조건** 만들어 붙였어요.
 * 그게 사실은 "우리는 정보가 없으니 직접 찾아보세요" 라는 뜻이라, 정보를
 * 가져와 정리해두는 방식과 어긋나요. 기간·장소·시간을 이미 화면에 적어놓고
 * 옆에 "네이버에서 찾아보세요" 를 나란히 두면 어느 쪽을 믿어야 할지 헷갈려요.
 *
 * 그래서 **근거(출처)가 이미 있으면 검색 링크를 만들지 않아요.** 출처는 아래
 * "출처" 자리에 따로 보여주고 있어서, 확인하려는 사람은 그걸 누르면 돼요.
 * 정리된 정보가 아예 없을 때만(관리자가 제목만 넣어둔 경우 등) 검색 링크를
 * 통로로 남겨둬요.
 *
 * 지도와 인스타그램은 성격이 달라서 그대로 둬요 — 지도는 "찾아가기" 고,
 * 인스타는 "가본 사람 후기" 라 우리가 정리해 줄 수 있는 정보가 아니에요.
 */
export function resolveLinks(p: PopupStore, opts: { hasSources?: boolean } = {}): PopupLink[] {
  const out: PopupLink[] = [...p.links];
  const has = (kind: PopupLink["kind"]) => out.some((l) => l.kind === kind);
  const keyword = `${p.brand} 팝업스토어`;
  /** 기간 말고 실제로 안내할 내용이 있는지 (없으면 검색 링크가 유일한 통로예요) */
  const organized = Boolean(opts.hasSources || p.hours || p.entry || p.description || p.venue);

  if (!has("naver") && !organized) {
    out.push({ kind: "naver", label: "네이버에서 정보 찾기", url: naverSearchUrl(keyword) });
  }
  if (!has("map") && p.address) {
    out.push({ kind: "map", label: "지도에서 위치 보기", url: naverMapUrl(`${p.city} ${p.venue}`) });
  }
  if (!has("instagram")) {
    out.push({ kind: "instagram", label: "인스타그램 후기 보기", url: instagramTagUrl(`${p.brand}팝업`) });
  }
  return out;
}

/**
 * "9월 9일에 확인한 정보예요" 에 쓸 문구.
 *
 * 정리해둔 정보의 수명을 사용자가 스스로 판단할 수 있게 해주는 값이에요.
 * 오늘·어제는 날짜보다 그 말이 더 잘 읽혀요.
 */
export function checkedAtText(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  // 날짜 경계로 세요 (시간 차로 세면 어제 23시가 "0일 전" 이 돼요)
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(new Date()) - day(then)) / 86_400_000);
  if (days <= 0) return "오늘 확인한 정보예요";
  if (days === 1) return "어제 확인한 정보예요";
  if (days < 14) return `${days}일 전에 확인한 정보예요`;
  return `${formatDateKo(then.toISOString().slice(0, 10))}에 확인한 정보예요`;
}

/** 예약 버튼 하나 — 관리자가 넣은 예약 링크가 있으면 그걸, 없으면 네이버 검색 */
export function reservationLink(p: PopupStore): { label: string; url: string } | null {
  if (p.reservation === "walkin") return null;
  const direct = p.links.find((l) => l.kind === p.reservation);
  if (direct) return { label: direct.label, url: direct.url };
  const wording: Record<Exclude<PopupStore["reservation"], "walkin">, string> = {
    catchtable: "캐치테이블에서 예약하기",
    naver: "네이버에서 예약하기",
    instagram: "인스타그램에서 예약 안내 보기",
  };
  const query =
    p.reservation === "catchtable"
      ? `${p.brand} 팝업 캐치테이블 예약`
      : p.reservation === "naver"
        ? `${p.brand} 팝업 네이버 예약`
        : `${p.brand} 팝업`;
  return {
    label: wording[p.reservation],
    url: p.reservation === "instagram" ? instagramTagUrl(`${p.brand}팝업`) : naverSearchUrl(query),
  };
}

/** 진행 중 → 예정 → 종료 순서, 그 안에서는 마감 임박 순 */
export function sortPopups<T extends Pick<PopupStore, "startDate" | "endDate">>(list: T[], now = new Date()): T[] {
  const rank: Record<PopupStatus, number> = { ongoing: 0, upcoming: 1, ended: 2 };
  return [...list].sort((a, b) => {
    const ra = rank[popupStatus(a, now)];
    const rb = rank[popupStatus(b, now)];
    if (ra !== rb) return ra - rb;
    if (ra === 2) return dayNumber(b.endDate) - dayNumber(a.endDate); // 최근 종료 먼저
    return dayNumber(a.endDate) - dayNumber(b.endDate);
  });
}
