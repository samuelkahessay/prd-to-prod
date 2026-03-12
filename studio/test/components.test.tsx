import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Hero } from "@/components/landing/hero";
import { RunsTable } from "@/components/console/runs-table";
import type { Run } from "@/lib/types";

describe("Hero", () => {
  it("renders headline and CTA", () => {
    render(<Hero />);
    expect(screen.getByText("Brief in.")).toBeInTheDocument();
    expect(screen.getByText("Production out.")).toBeInTheDocument();
    expect(screen.getByText("See it run")).toHaveAttribute("href", "/console");
  });

  it("renders all pipeline acts", () => {
    render(<Hero />);
    for (const act of ["Brief", "Plan", "Build", "Ship", "Heal"]) {
      expect(screen.getByText(act)).toBeInTheDocument();
    }
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
