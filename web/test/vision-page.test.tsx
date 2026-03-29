import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VisionPage from "@/app/vision/page";

describe("VisionPage", () => {
  it("frames the thesis for founders and investors with visible proof", () => {
    render(<VisionPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Code Generation Is Solved\. Delivery Isn't\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("For founders").length).toBeGreaterThan(0);
    expect(screen.getAllByText("For investors").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByText("end-to-end self-healing drills completed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "What founders and investors should notice.",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the founder and investor conversion paths visible", () => {
    render(<VisionPage />);

    expect(screen.getAllByRole("link", { name: "Book a call" })[0]).toHaveAttribute(
      "href",
      "https://calendly.com/kahessay",
    );
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
