import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "@/app/page";

vi.mock("@/data", () => ({
  getPipelineData: vi.fn().mockResolvedValue({
    issues: [],
    pullRequests: [],
    workflowRuns: [],
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/"),
}));

describe("Home page", () => {
  it("renders Pipeline Observatory heading", async () => {
    const page = await Home();
    render(page);
    expect(screen.getAllByText(/pipeline observatory/i).length).toBeGreaterThan(0);
  });
});
