import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import fixture from "@/data/fixtures/sample-user.json";
import type { DevCardData } from "@/data/types";

// Mock getDevCardData
vi.mock("@/data", () => ({
  getDevCardData: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ children, ...props }: any) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (React as any).createElement(tag, props, children),
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  layoutId: undefined,
}));

import { getDevCardData } from "@/data";
import CardPage from "../[username]/page";

const mockGetDevCardData = vi.mocked(getDevCardData);

describe("CardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the DevCard for fixture data", async () => {
    mockGetDevCardData.mockResolvedValue(fixture as DevCardData);

    const element = await CardPage({ params: { username: "octocat" } });
    render(element);

    expect(screen.getAllByText(/octocat/i).length).toBeGreaterThan(0);
  });

  it("calls notFound when getDevCardData throws a 404-like error", async () => {
    mockGetDevCardData.mockRejectedValue(new Error("Not found"));

    const { notFound } = await import("next/navigation");

    await expect(CardPage({ params: { username: "nonexistentuser99999" } })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFound).toHaveBeenCalled();
  });
});
