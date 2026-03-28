import { MovementSystem } from "@/components/factory/renderer-2d/movement";

describe("movement system", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
      return;
    }

    delete (window as Window & { matchMedia?: Window["matchMedia"] }).matchMedia;
  });

  it("walks queued routes in order", () => {
    const movement = new MovementSystem();
    movement.setHome("developer", 0, 0);

    movement.moveAlong("developer", [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);

    movement.update(1);
    movement.update(0.1);
    expect(movement.getPosition("developer")).toEqual({ x: 1, y: 0 });

    movement.update(1);
    movement.update(0.1);
    expect(movement.getPosition("developer")).toEqual({ x: 1, y: 1 });
    expect(movement.isWalking("developer")).toBe(false);
  });

  it("respects reduced motion and avoids starting travel", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }),
    });

    const movement = new MovementSystem();
    movement.setHome("developer", 0, 0);
    movement.moveAlong("developer", [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    movement.update(1);

    expect(movement.getPosition("developer")).toEqual({ x: 0, y: 0 });
    expect(movement.isWalking("developer")).toBe(false);
  });
});
