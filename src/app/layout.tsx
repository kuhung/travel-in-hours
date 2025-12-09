import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "出行可达地图 | Travel Reach Map",
  description: "基于 OpenRouteService 实时交通数据，查看从城市地标出发 1-3 小时内可达的区域。支持驾车、骑行、步行等多种出行方式。",
  keywords: ["可达地图", "等时圈", "通勤范围", "OpenRouteService", "交通分析", "城市交通"],
  authors: [{ name: "kuhung", url: "https://kuhung.me/about" }],
  openGraph: {
    title: "出行可达地图",
    description: "查看从城市地标出发，指定时间内可达的区域",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "出行可达地图",
    description: "查看从城市地标出发，指定时间内可达的区域",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
