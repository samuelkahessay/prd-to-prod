import { describe, it, expect, vi } from "vitest";
import fixture from "@/data/fixtures/sample-user.json";
import type { DevCardData } from "@/data/types";

// Mock @vercel/og before importing the route
vi.mock("@vercel/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(_jsx: unknown, init?: ResponseInit & { headers?: Record<string, string> }) {
      super(new Uint8Array([137, 80, 78, 71]), {
        ...init,
        headers: {
          "Content-Type": "image/png",
          ...(init?.headers ?? {}),
        },
      });
    }
  },
}));

vi.mock("@/data", () => ({
  getDevCardData: vi.fn().mockResolvedValue(fixture as DevCardData),
}));

describe("OG Image Route", () => {
  it("GET /api/og/octocat returns image/png response", async () => {
    const { GET } = await import("../[username]/route.tsx");
    const req = new Request("http://localhost/api/og/octocat");
    const res = await GET(req, { params: { username: "octocat" } });
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("GET /api/og/unknown returns 404 when data fetch fails", async () => {
    const { getDevCardData } = await import("@/data");
    vi.mocked(getDevCardData).mockRejectedValueOnce(new Error("not found"));
    const { GET } = await import("../[username]/route.tsx");
    const req = new Request("http://localhost/api/og/unknown");
    const res = await GET(req, { params: { username: "unknown" } });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("User not found");
  });
});
