// web/test/prd-to-prod-animation.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";

describe("PrdToProdAnimation", () => {
  it("renders all four letters in correct order", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    expect(container).toBeInTheDocument();
    expect(container.textContent).toBe("prod");
  });

  it("applies accessibility attributes", () => {
    render(<PrdToProdAnimation />);
    const el = screen.getByRole("img", { name: "prd to prod loading" });
    expect(el).toHaveAttribute("role", "img");
    expect(el).toHaveAttribute("aria-label", "prd to prod loading");
  });

  it("applies font size from size prop", () => {
    render(<PrdToProdAnimation size={24} />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.fontSize).toBe("24px");
  });

  it("clamps duration to minimum 2.5s", () => {
    render(<PrdToProdAnimation duration={1} />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--duration")).toBe("2.5s");
  });

  it("sets rotation CSS variables when rotation is true", () => {
    render(<PrdToProdAnimation rotation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--rotation")).toBe("2deg");
    expect(letters.style.getPropertyValue("--rotation-neg")).toBe("-2deg");
  });

  it("sets squash propagation CSS variables when enabled", () => {
    render(<PrdToProdAnimation squashPropagation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--ripple-squash-x")).toBe("1.1");
    expect(letters.style.getPropertyValue("--ripple-squash-y")).toBe("0.88");
  });

  it("does not set squash propagation vars by default", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--ripple-squash-x")).toBe("");
  });

  it("does not apply amplitude class for medium (default)", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.className).not.toContain("tight");
    expect(letters.className).not.toContain("full");
  });

  it("uses default duration of 3.6s", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--duration")).toBe("3.6s");
  });

  it("sets rotation to 0deg by default", () => {
    render(<PrdToProdAnimation />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.style.getPropertyValue("--rotation")).toBe("0deg");
    expect(letters.style.getPropertyValue("--rotation-neg")).toBe("0deg");
  });

  it("applies tight amplitude class", () => {
    render(<PrdToProdAnimation amplitude="tight" />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.className).toContain("tight");
  });

  it("applies full amplitude class", () => {
    render(<PrdToProdAnimation amplitude="full" />);
    const container = screen.getByRole("img", { name: "prd to prod loading" });
    const letters = container.firstElementChild as HTMLElement;
    expect(letters.className).toContain("full");
  });
});
