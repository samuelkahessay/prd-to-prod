import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VisionPage from "@/app/vision/page";

describe("VisionPage", () => {
  it("frames the thesis for founders and builders with visible proof", () => {
    render(<VisionPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Code Generation Is Solved\. Delivery Isn't\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("For founders").length).toBeGreaterThan(0);
    expect(screen.getAllByText("For builders").length).toBeGreaterThan(0);
    expect(screen.queryByText(/investors/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Aurrin Ventures went from brief to working product in 6 days\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Self-healing has already been proven end to end.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "What founders and builders should notice.",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the founder and builder paths visible without scheduling links", () => {
    render(<VisionPage />);

    expect(screen.queryByRole("link", { name: "Book a call" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review the repo" })).toHaveAttribute(
      "href",
      "https://github.com/samuelkahessay/prd-to-prod",
    );
    expect(screen.getByRole("link", { name: "Read the case study" })).toHaveAttribute(
      "href",
      "/case-studies/aurrin-ventures",
    );
  });
});
