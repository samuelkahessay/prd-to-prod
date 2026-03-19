import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Hero } from "@/components/landing/hero";
import { StickyNav } from "@/components/landing/sticky-nav";
import { Pricing } from "@/components/landing/pricing";
import { WhatYouGet } from "@/components/landing/what-you-get";
import { EvidenceLedger } from "@/components/landing/evidence-ledger";
import { BottomCta } from "@/components/landing/bottom-cta";
import { Credibility } from "@/components/landing/credibility";
import { BUILD_QUEUE, REVIEW_QUEUE } from "@/components/landing/pipeline-animation-data";
import { RunsTable } from "@/components/console/runs-table";
import type { EvidenceRow, Run } from "@/lib/types";

const MAILTO = "mailto:kahessay@icloud.com?subject=PRD%20Submission";

describe("Hero", () => {
  it("renders headline and CTA", () => {
    render(<Hero />);
    expect(screen.getByText("Powered by GitHub Agentic Workflows")).toBeInTheDocument();
    expect(screen.getByText(/Send a PRD/)).toBeInTheDocument();
    expect(screen.getByText(/Get a deployed app/)).toBeInTheDocument();
    expect(screen.getByText(/\$1\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send your PRD" })).toHaveAttribute("href", MAILTO);
    expect(screen.getByRole("link", { name: "Watch it build" })).toHaveAttribute("href", "/build?demo=true");
  });
});

describe("StickyNav", () => {
  it("renders anchor links and CTA", () => {
    render(<StickyNav />);
    expect(screen.getByRole("link", { name: "prd to prod" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "#pricing");
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/samuelkahessay/prd-to-prod",
    );
    expect(screen.getByRole("link", { name: "Send your PRD" })).toHaveAttribute("href", MAILTO);
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
  it("renders the $1 offer and self-hosted option", () => {
    render(<Pricing />);
    expect(screen.getByRole("heading", { name: "$1. One PRD. One deployed app." })).toBeInTheDocument();
    expect(screen.getByText("Early adopter")).toBeInTheDocument();
    expect(screen.getByText("Run it yourself")).toBeInTheDocument();
    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send your PRD" })).toHaveAttribute("href", MAILTO);
    expect(screen.getByRole("link", { name: "View on GitHub" })).toHaveAttribute(
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

describe("Credibility", () => {
  it("renders track record facts", () => {
    render(<Credibility />);
    expect(screen.getByText("Track record")).toBeInTheDocument();
    expect(screen.getByText("31 findings filed")).toBeInTheDocument();
    expect(screen.getByText("17 fixes shipped")).toBeInTheDocument();
    expect(screen.getByText("Sub-12-minute runs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: '"The New OSS"' })).toHaveAttribute(
      "href",
      "https://skahessay.dev",
    );
  });
});

describe("Pipeline animation queues", () => {
  it("advances all three decomposed issues through the build queue", () => {
    expect(BUILD_QUEUE.map((item) => item.issueNumber)).toEqual([1, 2, 3]);
    expect(BUILD_QUEUE.map((item) => item.prType)).toEqual(["pr-1", "pr-2", "pr-3"]);
  });

  it("includes a review-stage handoff for the third PR", () => {
    expect(REVIEW_QUEUE.map((item) => item.prType)).toContain("pr-3");
  });
});

describe("BottomCta", () => {
  it("renders the final call to action", () => {
    render(<BottomCta />);
    expect(screen.getByRole("heading", { name: "Send a PRD. Get a deployed app. $1." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send your PRD" })).toHaveAttribute("href", MAILTO);
    expect(screen.getByRole("link", { name: "View on GitHub" })).toHaveAttribute(
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
