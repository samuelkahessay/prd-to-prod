import type { WorkstationId } from "../factory-types";

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

export const ROOM_W = 12;
export const ROOM_D = 10;

export interface IsoViewport {
  cellSize: number;
  offsetX: number;
  offsetY: number;
  canvasW: number;
  canvasH: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenQuad {
  bl: ScreenPoint;
  br: ScreenPoint;
  tr: ScreenPoint;
  tl: ScreenPoint;
}

export function toIso(x: number, y: number): { x: number; y: number } {
  return {
    x: (x - y) * COS30,
    y: (x + y) * SIN30,
  };
}

export function createViewport(w: number, h: number): IsoViewport {
  const isoMinX = -ROOM_D * COS30;
  const isoMaxX = ROOM_W * COS30;
  const isoMaxY = (ROOM_W + ROOM_D) * SIN30;
  const isoWidth = isoMaxX - isoMinX;
  const isoHeight = isoMaxY;

  const floorH = h * 0.75;
  const cellSize = Math.min((w * 0.9) / isoWidth, floorH / isoHeight);

  return {
    cellSize,
    offsetX: w / 2 - ((isoMaxX + isoMinX) / 2) * cellSize,
    offsetY: h * 0.2,
    canvasW: w,
    canvasH: h,
  };
}

export function worldToScreen(
  vp: IsoViewport,
  wx: number,
  wy: number
): { x: number; y: number } {
  const iso = toIso(wx, wy);
  return {
    x: vp.offsetX + iso.x * vp.cellSize,
    y: vp.offsetY + iso.y * vp.cellSize,
  };
}

export function getScreenQuadFromEdge(
  edgeStart: ScreenPoint,
  edgeEnd: ScreenPoint,
  lift: number,
  height: number
): ScreenQuad {
  return {
    bl: { x: edgeStart.x, y: edgeStart.y - lift },
    br: { x: edgeEnd.x, y: edgeEnd.y - lift },
    tr: { x: edgeEnd.x, y: edgeEnd.y - lift - height },
    tl: { x: edgeStart.x, y: edgeStart.y - lift - height },
  };
}

export function traceScreenQuad(
  ctx: CanvasRenderingContext2D,
  quad: ScreenQuad
) {
  ctx.beginPath();
  ctx.moveTo(quad.bl.x, quad.bl.y);
  ctx.lineTo(quad.br.x, quad.br.y);
  ctx.lineTo(quad.tr.x, quad.tr.y);
  ctx.lineTo(quad.tl.x, quad.tl.y);
  ctx.closePath();
}

export function drawIsoFloor(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport
) {
  const tl = worldToScreen(vp, 0, 0);
  const tr = worldToScreen(vp, ROOM_W, 0);
  const br = worldToScreen(vp, ROOM_W, ROOM_D);
  const bl = worldToScreen(vp, 0, ROOM_D);

  // Warm wood floor
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fillStyle = "#e8ddd0";
  ctx.fill();

  // Subtle plank lines along x-axis
  ctx.strokeStyle = "rgba(160,140,115,0.1)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= ROOM_W; x += 1.5) {
    const from = worldToScreen(vp, x, 0);
    const to = worldToScreen(vp, x, ROOM_D);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // Cross-plank seams (less frequent)
  ctx.strokeStyle = "rgba(160,140,115,0.06)";
  for (let y = 0; y <= ROOM_D; y += 2) {
    const from = worldToScreen(vp, 0, y);
    const to = worldToScreen(vp, ROOM_W, y);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
}

export function drawIsoBlock(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  bw: number,
  bh: number,
  bd: number,
  colors: { top: string; front: string; side: string }
) {
  const p0 = worldToScreen(vp, wx, wy);
  const p1 = worldToScreen(vp, wx + bw, wy);
  const p2 = worldToScreen(vp, wx + bw, wy + bd);
  const p3 = worldToScreen(vp, wx, wy + bd);

  // Right side face
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p2.x, p2.y - bh);
  ctx.lineTo(p1.x, p1.y - bh);
  ctx.closePath();
  ctx.fillStyle = colors.side;
  ctx.fill();

  // Front face
  ctx.beginPath();
  ctx.moveTo(p3.x, p3.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p2.x, p2.y - bh);
  ctx.lineTo(p3.x, p3.y - bh);
  ctx.closePath();
  ctx.fillStyle = colors.front;
  ctx.fill();

  // Top face
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - bh);
  ctx.lineTo(p1.x, p1.y - bh);
  ctx.lineTo(p2.x, p2.y - bh);
  ctx.lineTo(p3.x, p3.y - bh);
  ctx.closePath();
  ctx.fillStyle = colors.top;
  ctx.fill();
}

// ── Isometric geometry helpers ─────────────────────────────

/** Draw a flat quad on the floor/desk plane at a given screen-pixel elevation */
export function drawIsoFlatQuad(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  w: number,
  d: number,
  elevation: number,
  fill: string
) {
  const p0 = worldToScreen(vp, wx, wy);
  const p1 = worldToScreen(vp, wx + w, wy);
  const p2 = worldToScreen(vp, wx + w, wy + d);
  const p3 = worldToScreen(vp, wx, wy + d);

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - elevation);
  ctx.lineTo(p1.x, p1.y - elevation);
  ctx.lineTo(p2.x, p2.y - elevation);
  ctx.lineTo(p3.x, p3.y - elevation);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Draw a quad on a wall plane (back wall: extends along x at wy=0; left wall: extends along y at wx=0) */
export function drawWallQuad(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  wallW: number,
  wallH: number,
  wall: "back" | "left",
  elevation: number,
  fill: string
) {
  let bl: { x: number; y: number };
  let br: { x: number; y: number };

  if (wall === "back") {
    // Wall runs along world x-axis at constant wy
    bl = worldToScreen(vp, wx, wy);
    br = worldToScreen(vp, wx + wallW, wy);
  } else {
    // Wall runs along world y-axis at constant wx
    bl = worldToScreen(vp, wx, wy);
    br = worldToScreen(vp, wx, wy + wallW);
  }

  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y - elevation);
  ctx.lineTo(br.x, br.y - elevation);
  ctx.lineTo(br.x, br.y - elevation - wallH);
  ctx.lineTo(bl.x, bl.y - elevation - wallH);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Stroke variant of wall quad (for outlines/frames) */
export function strokeWallQuad(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  wallW: number,
  wallH: number,
  wall: "back" | "left",
  elevation: number,
  stroke: string,
  lineWidth: number
) {
  let bl: { x: number; y: number };
  let br: { x: number; y: number };

  if (wall === "back") {
    bl = worldToScreen(vp, wx, wy);
    br = worldToScreen(vp, wx + wallW, wy);
  } else {
    bl = worldToScreen(vp, wx, wy);
    br = worldToScreen(vp, wx, wy + wallW);
  }

  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y - elevation);
  ctx.lineTo(br.x, br.y - elevation);
  ctx.lineTo(br.x, br.y - elevation - wallH);
  ctx.lineTo(bl.x, bl.y - elevation - wallH);
  ctx.closePath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** Get a ceiling/wall anchor point in screen coords */
export function ceilingAnchor(
  vp: IsoViewport,
  wx: number,
  wy: number,
  ceilingH: number
): { x: number; y: number } {
  const pos = worldToScreen(vp, wx, wy);
  return { x: pos.x, y: pos.y - ceilingH };
}

// ── Room anchors (shared positioning for backdrop elements) ──

export interface RoomAnchors {
  /** Window frame bounds in screen coords */
  window: { x: number; y: number; w: number; h: number };
  /** Back wall top-left and top-right in screen coords */
  backWall: { left: { x: number; y: number }; right: { x: number; y: number } };
}

export function computeRoomAnchors(vp: IsoViewport): RoomAnchors {
  const backLeft = worldToScreen(vp, 0, 0);
  const backRight = worldToScreen(vp, ROOM_W, 0);

  // Window: centered on back wall, occupies ~40% of wall width, top 35% of scene
  const wallScreenW = backRight.x - backLeft.x;
  const winW = wallScreenW * 0.55;
  const winH = vp.canvasH * 0.28;
  const winX = backLeft.x + (wallScreenW - winW) * 0.55; // slightly right of center
  const winY = vp.canvasH * 0.02;

  return {
    window: { x: winX, y: winY, w: winW, h: winH },
    backWall: { left: backLeft, right: backRight },
  };
}

export const WORLD_STATIONS: Record<
  WorkstationId,
  { x: number; y: number; label: string }
> = {
  "blueprint-table": { x: 2, y: 2.5, label: "BLUEPRINT" },
  "code-forge": { x: 6.5, y: 2, label: "CODE FORGE" },
  "design-web": { x: 2, y: 6.5, label: "DESIGN STUDIO" },
  "inspection-bay": { x: 7, y: 6, label: "INSPECTION" },
  "launch-pad": { x: 10, y: 4.5, label: "LAUNCH PAD" },
};
