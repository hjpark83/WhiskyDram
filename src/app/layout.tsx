import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR, Playfair_Display, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const notoSerifKr = Noto_Serif_KR({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FirstDram — 초보자를 위한 AI 위스키 소믈리에",
    template: "%s | FirstDram",
  },
  description:
    "취향 진단으로 나에게 맞는 첫 위스키를 찾고, 마트에서 병 사진만 찍으면 쉬운 말로 설명해주는 AI 위스키 소믈리에.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${notoSerifKr.variable} ${playfair.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
