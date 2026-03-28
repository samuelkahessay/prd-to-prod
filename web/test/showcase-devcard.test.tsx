import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "@/components/showcase/devcard/app";
import { renderDevCardToCanvas } from "@/components/showcase/devcard/export";
import { FIXTURE_PROFILES } from "@/components/showcase/devcard/fixtures";
import { THEMES } from "@/components/showcase/devcard/themes";

function createCanvasContextMock() {
  return {
    arc: jest.fn(),
    beginPath: jest.fn(),
    clip: jest.fn(),
    closePath: jest.fn(),
    drawImage: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    lineTo: jest.fn(),
    measureText: jest.fn((text: string) => ({ width: text.length * 5 })),
    moveTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    stroke: jest.fn(),
    fillStyle: "",
    font: "",
    lineWidth: 0,
    strokeStyle: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D & {
    drawImage: jest.Mock;
    fillText: jest.Mock;
  };
}

describe("DevCard showcase app", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "http://localhost/showcase/devcard");
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("hydrates the selected developer and theme from share params", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost/showcase/devcard?user=gaearon&theme=aurora"
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dan Abramov" })).toBeInTheDocument();
    });

    expect(screen.getByRole("textbox", { name: "GitHub username" })).toHaveValue("gaearon");
    expect(screen.getByRole("button", { name: "Aurora" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("copies a shareable link for the current developer and theme", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Dan Abramov/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aurora" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));

    await waitFor(() => {
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost/showcase/devcard?user=gaearon&theme=aurora"
      );
    });
  });

  it("renders avatar images and repo details into the PNG export canvas", () => {
    const ctx = createCanvasContextMock();
    renderDevCardToCanvas(
      ctx,
      FIXTURE_PROFILES[0],
      THEMES[0],
      { width: 64, height: 64 } as unknown as HTMLImageElement
    );

    const textCalls = ctx.fillText.mock.calls.map(([text]) => text);

    expect(ctx.drawImage).toHaveBeenCalled();
    expect(textCalls).toContain("Linux kernel source tree");
    expect(textCalls.some((text) => String(text).includes("⑂ 55.0k"))).toBe(true);
  });
});
