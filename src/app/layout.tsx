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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://keda.kuhung.me'),
  title: "出行可达地图 | 你的1小时逃离计划生成器",
  description: "输入出发地，一键生成1-3小时内的可达范围。无论是周末自驾逃离城市，还是城市漫步探索未知，发现你的生活半径极限。",
  keywords: ["可达地图", "等时圈", "周末去哪儿", "逃离北上广", "自驾游规划", "生活圈可视化", "OpenRouteService", "交通分析"],
  authors: [{ name: "kuhung", url: "https://kuhung.me/about" }],
  openGraph: {
    title: "出行可达地图 | 发现你的生活边界",
    description: "在这个城市，你的自由半径有多大？一键生成你的1-3小时出行圈。🚗 🚴‍♀️ 🚶",
    type: "website",
    locale: "zh_CN",
    siteName: "出行可达地图",
  },
  twitter: {
    card: "summary_large_image",
    title: "出行可达地图 | 发现你的生活边界",
    description: "在这个城市，你的自由半径有多大？一键生成你的1-3小时出行圈。",
    creator: "@kuhung",
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
