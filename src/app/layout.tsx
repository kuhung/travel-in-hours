import type { Metadata } from "next";
import PrivacyAnalytics from '@/components/App/PrivacyAnalytics';
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
  title: "出行可达地图 | 探索你的 1 小时生活圈",
  description: "输入出发地，查看固定 15 / 30 / 60 分钟（1小时内）出行可达范围。支持自驾、骑行与步行三种方式，发现周边已收录的可达地点。",
  keywords: ["可达地图", "等时圈", "周末去哪儿", "逃离北上广", "自驾游规划", "生活圈可视化", "OpenRouteService", "交通分析"],
  authors: [{ name: "kuhung", url: "https://kuhung.me/about" }],
  openGraph: {
    title: "出行可达地图 | 探索你的 1 小时生活圈",
    description: "输入出发地，查看 15 / 30 / 60 分钟出行可达范围与已收录地点。🚗 🚴 🚶",
    type: "website",
    locale: "zh_CN",
    siteName: "出行可达地图",
  },
  twitter: {
    card: "summary_large_image",
    title: "出行可达地图 | 探索你的 1 小时生活圈",
    description: "输入出发地，查看 15 / 30 / 60 分钟出行可达范围与已收录地点。",
    creator: "@kuhung",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "出行可达地图",
  "url": "https://keda.kuhung.me/",
  "description": "输入出发地，查看固定 15 / 30 / 60 分钟（1小时内）出行可达范围，用于发现周边可达地点与生活半径。",
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
    "固定 15、30、60 分钟（1小时内）等时圈",
    "自驾、骑行、步行三种出行方式",
    "已收录核心城市地标与周边地点发现",
    "支持从当前位置或地图选点探索"
  ]
};

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
          gtag('config', 'G-S9K4XS0DZ6', {
            page_location: window.location.origin + window.location.pathname,
            page_referrer: document.referrer.split('?')[0].split('#')[0]
          });
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
        <PrivacyAnalytics />
      </body>
    </html>
  );
}
