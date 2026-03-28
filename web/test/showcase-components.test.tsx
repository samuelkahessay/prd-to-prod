import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ShowcaseStrip } from "@/components/landing/showcase-strip";

describe("ShowcaseStrip", () => {
  it("renders all 5 app cards", () => {
    render(<ShowcaseStrip />);
    expect(screen.getByText("Code Snippet Manager")).toBeInTheDocument();
    expect(screen.getByText("Pipeline Observatory")).toBeInTheDocument();
    expect(screen.getByText("DevCard")).toBeInTheDocument();
    expect(screen.getByText("Ticket Deflection")).toBeInTheDocument();
    expect(screen.getByText("Compliance Scan Service")).toBeInTheDocument();
  });

  it("renders the CTA card with correct text", () => {
    render(<ShowcaseStrip />);
    expect(screen.getByText("Your PRD could be next")).toBeInTheDocument();
    expect(
      screen.getByText("Send us a product spec. Get back a real repo handoff in the invite-only beta.")
    ).toBeInTheDocument();
  });

  it("renders an 'Open showcase →' link for each app card", () => {
    render(<ShowcaseStrip />);
    const openLinks = screen.getAllByRole("link", { name: "Open showcase →" });
    expect(openLinks).toHaveLength(5);
  });

  it("each 'Open showcase →' link points to the correct slug path", () => {
    render(<ShowcaseStrip />);
    const openLinks = screen.getAllByRole("link", { name: "Open showcase →" });
    const hrefs = openLinks.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/showcase/code-snippets");
    expect(hrefs).toContain("/showcase/observatory");
    expect(hrefs).toContain("/showcase/devcard");
    expect(hrefs).toContain("/showcase/ticket-deflection");
    expect(hrefs).toContain("/showcase/compliance");
  });

  it("renders the section heading", () => {
    render(<ShowcaseStrip />);
    expect(screen.getByRole("heading", { name: "Built by the pipeline" })).toBeInTheDocument();
  });

  it("renders the 'Get started →' CTA link pointing to /build", () => {
    render(<ShowcaseStrip />);
    expect(screen.getByRole("link", { name: "Get started →" })).toHaveAttribute("href", "/build");
  });

  it("renders the 'See all →' link pointing to /showcase", () => {
    render(<ShowcaseStrip />);
    expect(screen.getByRole("link", { name: "See all →" })).toHaveAttribute("href", "/showcase");
  });

  it("renders month-only dates without timezone drift", () => {
    render(<ShowcaseStrip />);
    expect(screen.getAllByText("Feb 2026")).toHaveLength(4);
    expect(screen.getByText("Mar 2026")).toBeInTheDocument();
    expect(screen.queryByText("Jan 31, 2026")).not.toBeInTheDocument();
  });
});
