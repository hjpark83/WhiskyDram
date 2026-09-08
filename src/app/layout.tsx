import type { Metadata, Viewport } from "next";
import { BRAND } from "@/data/brand";
import { IBM_Plex_Sans_KR, Hahmlet, Cormorant_Garamond, Geist_Mono } from "next/font/google";
import { AmbientLight } from "@/components/ambient-light";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plexSansKr = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const hahmlet = Hahmlet({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.summary}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  // 홈 화면에 설치했을 때 앱처럼 뜨게 하는 설정 (자세한 건 app/manifest.ts)
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // 아이폰은 매니페스트의 display 를 안 봐요. 이 값이 있어야 주소창이 사라져요.
    capable: true,
    title: BRAND.nameKo,
    // 상단 시계·배터리 자리를 우리 배경색이 그대로 통과하게 (어두운 테마라)
    statusBarStyle: "black-translucent",
  },
  other: {
    // Next 는 표준 이름(`mobile-web-app-capable`)만 넣는데, iOS 17.4 이전
    // 사파리는 `apple-` 이 붙은 옛 이름만 읽어요. 아이폰이 옛날 버전이면
    // 이게 없으면 홈 화면에서 열어도 주소창이 그대로 남아요.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#14110d",
  // 노치가 있는 아이폰에서 화면 끝까지 쓰려면 이게 있어야 해요.
  // 하단 탭이 이미 safe-area 만큼 띄워 두고 있어서 가려지지 않아요.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${plexSansKr.variable} ${hahmlet.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AmbientLight />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
