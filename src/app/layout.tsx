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
  alternates: {
    canonical: '/',
  },
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "出行可达地图",
  "url": "https://keda.kuhung.me/",
  "description": "输入出发地，一键算出 15 分钟到 3 小时车程能到的范围，用来找周末去哪、看清自己的生活半径。",
  "applicationCategory": "TravelApplication",
  "operatingSystem": "Web Browser",
  "browserRequirements": "Requires JavaScript",
  "inLanguage": "zh-CN",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CNY"
  },
  "author": {
    "@type": "Person",
    "name": "kuhung",
    "url": "https://kuhung.me"
  },
  "featureList": [
    "按时间画可达范围",
    "15 分钟到 3 小时多档位",
    "周末自驾逃离城市",
    "城市漫步探索"
  ]
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-S9K4XS0DZ6" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-S9K4XS0DZ6');
        ` }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
