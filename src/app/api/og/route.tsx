import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "反旗 · FlagBreaker";
  const subtitle = searchParams.get("subtitle") ?? "AI 人设化反向自律打卡";
  const emoji = searchParams.get("emoji") ?? "🏴‍☠️";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f0f0f",
        backgroundImage:
          "radial-gradient(circle at 20% 80%, #1a1a2e 0%, #0f0f0f 50%)",
        color: "white",
        fontFamily: '"Noto Sans SC", sans-serif',
        padding: "80px",
      }}
    >
      <div style={{ fontSize: "80px", marginBottom: "24px" }}>{emoji}</div>
      <div
        style={{
          fontSize: "64px",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          marginBottom: "16px",
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          backgroundClip: "text",
          color: "transparent",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "28px",
          color: "#9ca3af",
          fontWeight: 400,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "48px",
          right: "64px",
          fontSize: "20px",
          color: "#4b5563",
        }}
      >
        flagbreaker.app
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
