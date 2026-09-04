import type { Metadata } from "next";
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
