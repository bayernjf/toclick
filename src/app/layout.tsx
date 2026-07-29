import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "@/components/SWRegister";
import OfflineBanner from "@/components/OfflineBanner";

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
};

export const viewport: Viewport = {
  // 移动端适配：禁止缩放，宽度铺满
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FF9F43",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <SWRegister />
        <OfflineBanner />
        <div className="app-container">{children}</div>
      </body>
    </html>
  );
}
