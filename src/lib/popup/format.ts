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
 * 관리자가 넣은 링크를 먼저 쓰고, 없는 종류는 검색 링크로 채워요.
 * (캐치테이블·네이버는 공개 API가 없어서 예약 링크는 관리자 입력값을 그대로 이어줘요.)
 */
export function resolveLinks(p: PopupStore): PopupLink[] {
  const out: PopupLink[] = [...p.links];
  const has = (kind: PopupLink["kind"]) => out.some((l) => l.kind === kind);
  const keyword = `${p.brand} 팝업스토어`;

  if (!has("naver")) {
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
