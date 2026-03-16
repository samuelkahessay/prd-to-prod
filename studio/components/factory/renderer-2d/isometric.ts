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

export const WORLD_STATIONS: Record<
  WorkstationId,
  { x: number; y: number; label: string }
> = {
  "blueprint-table": { x: 2, y: 2.5, label: "BLUEPRINT" },
  "code-forge": { x: 6.5, y: 2, label: "CODE FORGE" },
  "design-studio": { x: 2, y: 6.5, label: "DESIGN STUDIO" },
  "inspection-bay": { x: 7, y: 6, label: "INSPECTION" },
  "launch-pad": { x: 10, y: 4.5, label: "LAUNCH PAD" },
};
