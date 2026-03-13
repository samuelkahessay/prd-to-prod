import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Hero } from "@/components/landing/hero";
import { StickyNav } from "@/components/landing/sticky-nav";
import { Pricing } from "@/components/landing/pricing";
import { WhatYouGet } from "@/components/landing/what-you-get";
import { EvidenceLedger } from "@/components/landing/evidence-ledger";
import { BottomCta } from "@/components/landing/bottom-cta";
import { RunsTable } from "@/components/console/runs-table";
import type { EvidenceRow, Run } from "@/lib/types";

const MAILTO = "mailto:kahessay@icloud.com?subject=PRD%20Submission";

describe("Hero", () => {
  it("renders headline and CTA", () => {
    render(<Hero />);
    expect(screen.getByText("Powered by GitHub Agentic Workflows")).toBeInTheDocument();
    expect(screen.getByText("Send a PRD.")).toBeInTheDocument();
    expect(screen.getByText("Get a deployed app.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send your PRD →" })).toHaveAttribute("href", MAILTO);
    expect(screen.getByRole("link", { name: "See pricing" })).toHaveAttribute("href", "#pricing");
  });
});

describe("StickyNav", () => {
  it("renders anchor links and CTA", () => {
    render(<StickyNav />);
    expect(screen.getByRole("link", { name: "prd-to-prod" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "#pricing");
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByRole("link", { name: "For Teams" })).toHaveAttribute("href", "#for-teams");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/samuelkahessay/prd-to-prod",
    );
    expect(screen.getByRole("link", { name: "Send your PRD →" })).toHaveAttribute("href", MAILTO);
  });

  it("adds the scrolled class after scrolling past the threshold", () => {
    render(<StickyNav />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).not.toContain("scrolled");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 120,
    });
    fireEvent.scroll(window);

    expect(nav.className).toContain("scrolled");
  });
});

describe("Pricing", () => {
  it("renders both offers and the scope guardrails", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.getByText("We run it for you")).toBeInTheDocument();
    expect(screen.getByText("Run it yourself")).toBeInTheDocument();
    expect(screen.getByText("What's in scope today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send your PRD →" })).toHaveAttribute("href", MAILTO);
    expect(screen.getByRole("link", { name: "View on GitHub →" })).toHaveAttribute(
      "href",
      "https://github.com/samuelkahessay/prd-to-prod",
    );
  });
});

describe("WhatYouGet", () => {
  it("renders the core deliverables", () => {
    render(<WhatYouGet />);
    expect(screen.getByRole("heading", { name: "Not a prototype. A deployed product." })).toBeInTheDocument();
    expect(screen.getByText("A real repo")).toBeInTheDocument();
    expect(screen.getByText("CI/CD from day one")).toBeInTheDocument();
    expect(screen.getByText("It stays healthy")).toBeInTheDocument();
  });
});

describe("EvidenceLedger", () => {
  it("shows an empty state when evidence is unavailable", () => {
    render(<EvidenceLedger rows={[]} />);
    expect(screen.getByText("Recent activity unavailable.")).toBeInTheDocument();
  });

  it("limits the display to five recent events", () => {
    const rows: EvidenceRow[] = Array.from({ length: 6 }, (_, index) => ({
      time: `10:0${index}`,
      event: `Event ${index + 1}`,
      refs: [
        {
          label: `#${index + 1}`,
          url: `https://example.com/${index + 1}`,
          type: "issue",
        },
      ],
      duration: `${index + 1}m`,
      outcome: "running",
    }));

    render(<EvidenceLedger rows={rows} />);

    expect(screen.getByText("Event 1")).toBeInTheDocument();
    expect(screen.getByText("Event 5")).toBeInTheDocument();
    expect(screen.queryByText("Event 6")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing\s+5\s+recent events/)).toBeInTheDocument();
  });
});

describe("BottomCta", () => {
  it("renders the final call to action", () => {
    render(<BottomCta />);
    expect(screen.getByRole("heading", { name: "Ready to ship something?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send your PRD →" })).toHaveAttribute("href", MAILTO);
    expect(screen.getByRole("link", { name: "View on GitHub →" })).toHaveAttribute(
      "href",
      "https://github.com/samuelkahessay/prd-to-prod",
    );
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
