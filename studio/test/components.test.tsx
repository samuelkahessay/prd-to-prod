import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Hero } from "@/components/landing/hero";
import { StickyNav } from "@/components/landing/sticky-nav";
import { RunsTable } from "@/components/console/runs-table";
import type { Run } from "@/lib/types";

describe("Hero", () => {
  it("renders headline and CTA", () => {
    render(<Hero />);
    expect(
      screen.getByRole("heading", { name: "Send a PRD. Get a deployed app." })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Powered by GitHub Agentic Workflows")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send your PRD →" })).toHaveAttribute(
      "href",
      "mailto:sam@skahessay.dev?subject=PRD%20Submission"
    );
  });

  it("renders pricing link and first-project messaging", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: "See pricing" })).toHaveAttribute(
      "href",
      "#pricing"
    );
    expect(screen.getByText(/First project free\./)).toBeInTheDocument();
  });
});

describe("StickyNav", () => {
  it("initializes as scrolled when mounted below the hero", () => {
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 192,
    });

    render(<StickyNav />);

    expect(screen.getByRole("navigation")).toHaveClass("scrolled");
  });
});

describe("RunsTable", () => {
  it("shows empty state when no runs", () => {
    render(<RunsTable runs={[]} />);
    expect(screen.getByText("No runs yet. Launch one above.")).toBeInTheDocument();
  });

  it("renders runs with status and summary", () => {
    const runs: Run[] = [
      {
        id: "abcd-1234",
        createdAt: "2026-03-12T10:00:00Z",
        updatedAt: "2026-03-12T10:05:00Z",
        status: "completed",
        mode: "new",
        inputSource: "notes",
        targetRepo: "samuelkahessay/test",
        summary: "Add auth flow",
      },
    ];
    render(<RunsTable runs={runs} />);
    expect(screen.getByText("Add auth flow")).toBeInTheDocument();
    expect(screen.getByText(/completed/)).toBeInTheDocument();
  });
});
