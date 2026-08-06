import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "@/components/SWRegister";
import OfflineBanner from "@/components/OfflineBanner";
import ErrorBoundary from "@/components/ErrorBoundary";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://flagbreaker.app";

export const metadata: Metadata = {
  title: "反旗 · 立 flag 的人千千万，倒 flag 的你一个",
  description: "一个嘴毒心软的 AI 损友，盯你把事做完",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "反旗",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "format-detection": "telephone=no",
  },
  openGraph: {
    type: "website",
    title: "反旗 · FlagBreaker",
    description: "一个嘴毒心软的 AI 损友，盯你把事做完",
    url: SITE_URL,
    siteName: "反旗 · FlagBreaker",
    images: [
      {
        url: `${SITE_URL}/api/og?title=${encodeURIComponent("反旗 · FlagBreaker")}&subtitle=${encodeURIComponent("AI 人设化反向自律打卡")}&emoji=🏴‍☠️`,
        width: 1200,
        height: 630,
      },
    ],
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "反旗 · FlagBreaker",
    description: "一个嘴毒心软的 AI 损友，盯你把事做完",
    images: [
      `${SITE_URL}/api/og?title=${encodeURIComponent("反旗 · FlagBreaker")}&subtitle=${encodeURIComponent("AI 人设化反向自律打卡")}&emoji=🏴‍☠️`,
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FF9F43" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a14" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: read theme preference before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var t = localStorage.getItem('flagbreaker-theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
          `.trim(),
          }}
        />
      </head>
      <body>
        <SWRegister />
        <OfflineBanner />
        <div className="app-container">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
