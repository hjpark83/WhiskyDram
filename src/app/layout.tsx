import type { Metadata } from "next";
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
