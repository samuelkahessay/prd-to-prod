import {
  createViewport,
  getScreenQuadFromEdge,
  worldToScreen,
} from "@/components/factory/renderer-2d/isometric";

describe("isometric screen quads", () => {
  const viewport = createViewport(900, 600);

  it("keeps top and bottom edges parallel", () => {
    const quad = getScreenQuadFromEdge(
      { x: 100, y: 200 },
      { x: 220, y: 260 },
      12,
      48
    );

    expect(quad.br.y - quad.bl.y).toBe(60);
    expect(quad.tr.y - quad.tl.y).toBe(60);
    expect(quad.bl.y - quad.tl.y).toBe(48);
    expect(quad.br.y - quad.tr.y).toBe(48);
  });

  it("produces diagonal wall-plane edges from world-space back-wall points", () => {
    const quad = getScreenQuadFromEdge(
      worldToScreen(viewport, 4.5, 0),
      worldToScreen(viewport, 8.5, 0),
      0,
      120
    );

    expect(quad.bl.y).not.toBeCloseTo(quad.br.y);
    expect(quad.tl.y).not.toBeCloseTo(quad.tr.y);
  });

  it("produces diagonal front-face edges from world-space prop points", () => {
    const quad = getScreenQuadFromEdge(
      worldToScreen(viewport, 0.2, 1.5),
      worldToScreen(viewport, 0.8, 1.5),
      36,
      42
    );

    expect(quad.bl.y).not.toBeCloseTo(quad.br.y);
    expect(quad.tl.y).not.toBeCloseTo(quad.tr.y);
  });
});
