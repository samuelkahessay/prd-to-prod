import { ImageResponse } from "@vercel/og";
import { NextResponse } from "next/server";
import { getDevCardData } from "@/data";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: { username: string } }
) {
  const { username } = params;

  let data;
  try {
    data = await getDevCardData(username);
  } catch {
    return new NextResponse("User not found", { status: 404 });
  }

  const { user, languages } = data;
  const topLangs = languages.slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#0f172a",
          padding: "48px",
          fontFamily: "sans-serif",
          color: "white",
          justifyContent: "space-between",
        }}
      >
        {/* Top: avatar + user info + languages */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {/* Left: avatar + name */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.avatarUrl}
              width={128}
              height={128}
              style={{ borderRadius: "50%", objectFit: "cover" }}
              alt=""
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "32px", fontWeight: "bold", color: "white" }}>
                {user.name ?? user.login}
              </span>
              <span style={{ fontSize: "20px", color: "#94a3b8" }}>@{user.login}</span>
              {user.bio && (
                <span
                  style={{
                    fontSize: "16px",
                    color: "#94a3b8",
                    maxWidth: "400px",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {user.bio}
                </span>
              )}
            </div>
          </div>

          {/* Right: top 3 languages */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-end" }}>
            {topLangs.map((lang) => (
              <div key={lang.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: lang.color,
                  }}
                />
                <span style={{ fontSize: "18px", color: "#e2e8f0" }}>{lang.name}</span>
                <span style={{ fontSize: "16px", color: "#64748b" }}>{lang.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: language bar + watermark */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
            {languages.map((lang) => (
              <div
                key={lang.name}
                style={{
                  flex: `0 0 ${lang.percentage}%`,
                  backgroundColor: lang.color,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontSize: "14px", color: "#475569" }}>DevCard</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
