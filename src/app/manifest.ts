import type { MetadataRoute } from "next";
import { BRAND } from "@/data/brand";

/**
 * 홈 화면에 앱처럼 설치되게 하는 파일 (PWA 매니페스트).
 *
 * ## 왜 이걸 먼저 하나
 *
 * "앱스토어에 내고 싶다" 의 90%는 **홈 화면 아이콘 + 주소창 없는 전체 화면**
 * 이에요. 그건 스토어 심사도 개발자 계정도 없이 지금 되고, 아이폰·안드로이드
 * 모두 됩니다. 나중에 진짜 스토어에 낼 때도 이 웹앱을 그대로 감싸면 돼서,
 * 버리는 작업이 아니에요.
 *
 * ## `display: standalone`
 *
 * 설치한 뒤 열면 사파리·크롬 주소창이 사라지고 앱처럼 떠요. 이게 없으면
 * 홈 화면 아이콘을 눌러도 그냥 브라우저가 열려서 "앱 같다" 는 느낌이 안 나요.
 *
 * ## 세로 고정
 *
 * 지구본·3D 병·하단 탭이 전부 세로 기준으로 짜여 있어요. 가로로 돌리면
 * 하단 탭이 화면 절반을 먹어서, 회전을 막는 편이 나아요.
 *
 * 아이콘은 `icon.svg` / `apple-icon.tsx` 가 이미 만들어 주고 있어서
 * 여기서는 그 주소만 가리켜요 (같은 그림을 두 번 관리하지 않으려고요).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.summary}`,
    short_name: BRAND.nameKo,
    description: BRAND.description,
    start_url: "/home",
    // 설치 안 한 사람이 브라우저로 들어오는 자리(랜딩)와, 설치한 사람이
    // 아이콘을 눌렀을 때 가는 자리(홈)는 달라야 해요. 이미 쓰는 사람에게
    // 소개 페이지를 다시 보여줄 이유가 없거든요.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ko",
    background_color: "#14110d",
    theme_color: "#14110d",
    categories: ["food", "lifestyle", "education"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180", purpose: "any" },
    ],
    shortcuts: [
      // 홈 화면 아이콘을 길게 누르면 나오는 바로가기예요. 마트에서 병을
      // 만난 순간 바로 스캔으로 들어가는 게 이 서비스의 핵심 동작이라
      // 두 번 탭할 것을 한 번으로 줄여요.
      { name: "병 스캔", short_name: "스캔", url: "/scan" },
      { name: "내 추천", short_name: "추천", url: "/recommend" },
    ],
  };
}
