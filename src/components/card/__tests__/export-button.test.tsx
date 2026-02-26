import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExportButton from "../export-button";

vi.mock("html-to-image", () => ({
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,abc"),
}));

describe("ExportButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // Provide a mock card root element
    const div = document.createElement("div");
    div.setAttribute("data-card-root", "true");
    document.body.appendChild(div);
  });

  it("renders Download PNG and Copy Link buttons", () => {
    render(<ExportButton username="octocat" accentColor="#6366f1" />);
    expect(screen.getByText("Download PNG")).toBeDefined();
    expect(screen.getByText("Copy Link")).toBeDefined();
  });

  it("Copy Link calls navigator.clipboard.writeText with current URL", async () => {
    render(<ExportButton username="octocat" accentColor="#6366f1" />);
    const btn = screen.getByText("Copy Link");
    fireEvent.click(btn);
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        window.location.href
      );
    });
  });
});
