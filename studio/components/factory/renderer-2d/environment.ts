import type { FactoryState, WorkstationId } from "../factory-types";
import {
  IsoViewport,
  worldToScreen,
  drawIsoBlock,
  drawIsoFlatQuad,
  drawWallQuad,
  strokeWallQuad,
  computeRoomAnchors,
  WORLD_STATIONS,
  ROOM_W,
  getScreenQuadFromEdge,
  traceScreenQuad,
} from "./isometric";

// Extended palette
const E = {
  wood: "#c4a882",
  woodDark: "#a8896a",
  woodLight: "#dcc8a8",
  deskTop: "#d4c4a8",
  deskFront: "#b8a888",
  deskSide: "#beae92",
  darkTop: "#3a3a3a",
  darkFront: "#2a2a2a",
  darkSide: "#333",
  monitor: "#1e1e1e",
  screenOff: "#111",
  sky: "#87CEEB",
  skyTop: "#5ba3d9",
  cloud: "rgba(255,255,255,0.85)",
  sun: "#FFD700",
  skyline: "#3a4a5c",
  skylineLight: "#4a5a6c",
  wallBg: "#f0ebe4",
};

function fillQuad(
  ctx: CanvasRenderingContext2D,
  quad: ReturnType<typeof getScreenQuadFromEdge>,
  fill: string
) {
  traceScreenQuad(ctx, quad);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeQuad(
  ctx: CanvasRenderingContext2D,
  quad: ReturnType<typeof getScreenQuadFromEdge>,
  stroke: string,
  lineWidth: number
) {
  traceScreenQuad(ctx, quad);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function clipQuad(
  ctx: CanvasRenderingContext2D,
  quad: ReturnType<typeof getScreenQuadFromEdge>
) {
  traceScreenQuad(ctx, quad);
  ctx.clip();
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function quadBounds(quad: ReturnType<typeof getScreenQuadFromEdge>) {
  const xs = [quad.bl.x, quad.br.x, quad.tr.x, quad.tl.x];
  const ys = [quad.bl.y, quad.br.y, quad.tr.y, quad.tl.y];
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

// ── Backdrop (window, lamps) ──────────────────────────────

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  time: number
) {
  const anchors = computeRoomAnchors(vp);
  const { x: cx, y: wy, w: ww, h: wh } = anchors.window;

  // Back wall hint
  const wallTop = anchors.backWall.left;
  const wallRight = anchors.backWall.right;
  ctx.fillStyle = E.wallBg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vp.canvasW, 0);
  ctx.lineTo(wallRight.x, wallRight.y);
  ctx.lineTo(wallTop.x, wallTop.y);
  ctx.lineTo(0, wallTop.y * 0.6);
  ctx.closePath();
  ctx.fill();

  const wallSlope =
    (wallRight.y - wallTop.y) / Math.max(1, wallRight.x - wallTop.x);
  const outerBottomLeft = { x: cx - 4, y: wy + wh + 4 };
  const outerBottomRight = {
    x: cx + ww + 4,
    y: wy + wh + 4 + (ww + 8) * wallSlope,
  };
  const outerWindow = getScreenQuadFromEdge(
    outerBottomLeft,
    outerBottomRight,
    0,
    wh + 8
  );
  const innerBottomLeft = { x: cx + 6, y: wy + wh - 6 };
  const innerBottomRight = {
    x: cx + ww - 6,
    y: wy + wh - 6 + (ww - 12) * wallSlope,
  };
  const innerWindow = getScreenQuadFromEdge(
    innerBottomLeft,
    innerBottomRight,
    0,
    wh - 12
  );

  fillQuad(ctx, outerWindow, "#d4ccc0");
  fillQuad(ctx, innerWindow, "#7bb5dd");

  // Sky gradient inside the skewed window
  const skyBounds = quadBounds(innerWindow);
  const skyGrad = ctx.createLinearGradient(
    skyBounds.minX,
    skyBounds.minY,
    skyBounds.minX,
    skyBounds.maxY
  );
  skyGrad.addColorStop(0, E.skyTop);
  skyGrad.addColorStop(0.6, E.sky);
  skyGrad.addColorStop(1, "#b8dff0");

  ctx.save();
  clipQuad(ctx, innerWindow);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(
    skyBounds.minX - 8,
    skyBounds.minY - 8,
    skyBounds.maxX - skyBounds.minX + 16,
    skyBounds.maxY - skyBounds.minY + 16
  );

  // Sun
  const sunX = cx + ww * 0.75;
  const sunY = wy + wh * 0.25;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 25);
  sunGlow.addColorStop(0, "rgba(255,215,0,0.6)");
  sunGlow.addColorStop(1, "rgba(255,215,0,0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 25, sunY - 25, 50, 50);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 8, 0, Math.PI * 2);
  ctx.fillStyle = E.sun;
  ctx.fill();

  // Clouds
  drawCloud(ctx, cx + ww * 0.2, wy + wh * 0.18, 18, time);
  drawCloud(ctx, cx + ww * 0.55, wy + wh * 0.12, 14, time * 0.7);
  drawCloud(ctx, cx + ww * 0.85, wy + wh * 0.28, 10, time * 1.2);

  // City skyline
  const baseY = wy + wh - 1;
  const buildings = [
    { x: 0.05, w: 0.06, h: 0.18 },
    { x: 0.12, w: 0.05, h: 0.28 },
    { x: 0.18, w: 0.07, h: 0.22 },
    { x: 0.26, w: 0.04, h: 0.35 },
    { x: 0.31, w: 0.06, h: 0.2 },
    { x: 0.38, w: 0.05, h: 0.25 },
    { x: 0.44, w: 0.08, h: 0.15 },
    { x: 0.53, w: 0.04, h: 0.32 },
    { x: 0.58, w: 0.06, h: 0.2 },
    { x: 0.65, w: 0.07, h: 0.26 },
    { x: 0.73, w: 0.05, h: 0.18 },
    { x: 0.79, w: 0.06, h: 0.3 },
    { x: 0.86, w: 0.04, h: 0.22 },
    { x: 0.91, w: 0.07, h: 0.16 },
  ];
  for (const b of buildings) {
    const bx = cx + ww * b.x;
    const bw = ww * b.w;
    const bh = wh * b.h;
    ctx.fillStyle = E.skyline;
    ctx.fillRect(bx, baseY - bh, bw, bh);
    // Tiny windows
    ctx.fillStyle = "rgba(255,230,150,0.4)";
    for (let ry = 0; ry < bh - 3; ry += 4) {
      for (let rx = 2; rx < bw - 2; rx += 3) {
        if (Math.sin(bx * 7 + ry * 3 + rx * 11) > 0.3) {
          ctx.fillRect(bx + rx, baseY - bh + ry + 2, 1.5, 1.5);
        }
      }
    }
  }

  ctx.restore();

  // Window divider cross
  const dividerBottomX = lerp(innerWindow.bl.x, innerWindow.br.x, 0.5);
  ctx.strokeStyle = "#c4bbb0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dividerBottomX, innerWindow.tl.y);
  ctx.lineTo(dividerBottomX, innerWindow.bl.y);
  ctx.moveTo(
    lerp(innerWindow.tl.x, innerWindow.bl.x, 0.45),
    lerp(innerWindow.tl.y, innerWindow.bl.y, 0.45)
  );
  ctx.lineTo(
    lerp(innerWindow.tr.x, innerWindow.br.x, 0.45),
    lerp(innerWindow.tr.y, innerWindow.br.y, 0.45)
  );
  ctx.stroke();

  // Pendant lamps — x from back-wall projection, y near top of canvas
  const lamp1pos = worldToScreen(vp, 2, 0);
  const lamp2pos = worldToScreen(vp, 6, 0);
  const lamp3pos = worldToScreen(vp, 10, 0);
  drawPendantLamp(ctx, lamp1pos.x, 0, vp.canvasH * 0.12);
  drawPendantLamp(ctx, lamp2pos.x, 0, vp.canvasH * 0.1);
  drawPendantLamp(ctx, lamp3pos.x, 0, vp.canvasH * 0.14);
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number
) {
  const drift = Math.sin(time * 0.15) * 3;
  ctx.fillStyle = E.cloud;
  ctx.beginPath();
  ctx.arc(x + drift, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + drift + size * 0.4, y - size * 0.15, size * 0.6, 0, Math.PI * 2);
  ctx.arc(x + drift + size * 0.85, y, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawPendantLamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  lampY: number
) {
  // Cord
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x, lampY);
  ctx.stroke();

  // Shade (skewed to match the isometric room)
  const shade = [
    { x, y: lampY },
    { x: x + 7, y: lampY + 3 },
    { x: x + 4, y: lampY + 9 },
    { x: x - 7, y: lampY + 9 },
    { x: x - 11, y: lampY + 5 },
  ];
  ctx.fillStyle = "#c8a86e";
  ctx.beginPath();
  ctx.moveTo(shade[0].x, shade[0].y);
  for (let i = 1; i < shade.length; i += 1) {
    ctx.lineTo(shade[i].x, shade[i].y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#ad8d58";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(shade[4].x, shade[4].y);
  ctx.lineTo(shade[1].x, shade[1].y);
  ctx.lineTo(shade[2].x, shade[2].y);
  ctx.stroke();

  // Warm glow
  const glow = ctx.createRadialGradient(x, lampY + 14, 2, x, lampY + 14, 30);
  glow.addColorStop(0, "rgba(255,220,150,0.1)");
  glow.addColorStop(1, "rgba(255,220,150,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x + 2, lampY + 22, 30, 14, Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();
}

// ── Workstation Furniture ─────────────────────────────────

export function drawAllFurniture(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  state: FactoryState,
  time: number
) {
  // Sort by world y for depth ordering
  const stations = (Object.keys(WORLD_STATIONS) as WorkstationId[]).sort(
    (a, b) => WORLD_STATIONS[a].y - WORLD_STATIONS[b].y
  );

  for (const wsId of stations) {
    const ws = WORLD_STATIONS[wsId];
    const isActive = state.workstations[wsId].activeAgent !== null;

    switch (wsId) {
      case "blueprint-table":
        drawBlueprintTable(ctx, vp, ws.x, ws.y, isActive, time, state);
        break;
      case "code-forge":
        drawCodeForge(ctx, vp, ws.x, ws.y, isActive, time);
        break;
      case "design-studio":
        drawDesignStudio(ctx, vp, ws.x, ws.y, isActive, time);
        break;
      case "inspection-bay":
        drawInspectionBay(ctx, vp, ws.x, ws.y, isActive, state);
        break;
      case "launch-pad":
        drawLaunchPad(ctx, vp, ws.x, ws.y, isActive, time, state);
        break;
    }

    // Station label
    const labelPos = worldToScreen(vp, ws.x + 0.8, ws.y + 1.2);
    ctx.font = `600 ${Math.max(7, vp.cellSize * 0.28)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = isActive ? "#5c554e" : "#b5afa8";
    ctx.fillText(ws.label, labelPos.x, labelPos.y + vp.cellSize * 0.6);
  }
}

function drawBlueprintTable(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  active: boolean,
  _time: number,
  state: FactoryState
) {
  // Warm wood desk
  drawIsoBlock(ctx, vp, wx, wy, 2, vp.cellSize * 0.7, 1.2, {
    top: E.deskTop,
    front: E.deskFront,
    side: E.deskSide,
  });
  const h = vp.cellSize * 0.7;

  // Whiteboard behind desk — on back-wall plane
  const wbWorldW = 1.8; // world units wide along x-axis
  const wbH = vp.cellSize * 1;
  const wbElev = h + vp.cellSize * 0.2; // above desk height

  // Board fill
  drawWallQuad(ctx, vp, wx + 0.1, wy - 0.3, wbWorldW, wbH, "back", wbElev, "#fff");
  // Board border
  strokeWallQuad(ctx, vp, wx + 0.1, wy - 0.3, wbWorldW, wbH, "back", wbElev, "#c4bbb0", 1.5);

  // Sticky notes clipped to whiteboard quad
  const wbBL = worldToScreen(vp, wx + 0.1, wy - 0.3);
  const wbBR = worldToScreen(vp, wx + 0.1 + wbWorldW, wy - 0.3);
  const wbScreenW = wbBR.x - wbBL.x;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wbBL.x, wbBL.y - wbElev);
  ctx.lineTo(wbBR.x, wbBR.y - wbElev);
  ctx.lineTo(wbBR.x, wbBR.y - wbElev - wbH);
  ctx.lineTo(wbBL.x, wbBL.y - wbElev - wbH);
  ctx.closePath();
  ctx.clip();

  const noteColors = ["#fff3b0", "#b0e0ff", "#ffb0b0", "#b0ffb0"];
  const noteCount = Math.min(state.output.issueCount + 1, 4);
  for (let i = 0; i < noteCount; i++) {
    const nx = wbBL.x + 4 + (i % 2) * (wbScreenW * 0.4);
    const ny = wbBL.y - wbElev - wbH + 4 + Math.floor(i / 2) * (wbH * 0.45);
    ctx.fillStyle = noteColors[i];
    ctx.fillRect(nx, ny, wbScreenW * 0.2, wbH * 0.35);
  }
  ctx.restore();

  // Scattered papers on desk
  if (active) {
    drawIsoFlatQuad(ctx, vp, wx + 0.45, wy + 0.26, 0.34, 0.24, h + 2, "#fff");
    drawIsoFlatQuad(ctx, vp, wx + 0.95, wy + 0.42, 0.36, 0.26, h + 1, "#fbfaf7");
  }
}

function drawCodeForge(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  active: boolean,
  time: number
) {
  // Dark desk
  drawIsoBlock(ctx, vp, wx, wy, 2.2, vp.cellSize * 0.65, 1, {
    top: E.darkTop,
    front: E.darkFront,
    side: E.darkSide,
  });

  const h = vp.cellSize * 0.65;

  // Triple monitors — wall quads standing on desk, facing back wall
  const monWorldW = 0.6; // each monitor width in world units
  const monSpacing = 0.05;
  const monH = vp.cellSize * 0.38;
  const monElev = h + 4; // sits just above desk

  for (let i = 0; i < 3; i++) {
    const monX = wx + 0.2 + i * (monWorldW + monSpacing);

    // Monitor frame
    drawWallQuad(ctx, vp, monX, wy + 0.15, monWorldW, monH, "back", monElev, "#1a1a1a");

    // Screen inset
    const screenInset = 0.05;
    const screenH = monH - 4;
    drawWallQuad(ctx, vp, monX + screenInset, wy + 0.15, monWorldW - screenInset * 2, screenH, "back", monElev + 2, active ? "#1e2127" : E.screenOff);

    // Code lines when active — clipped to screen quad
    if (active) {
      const screenBL = worldToScreen(vp, monX + screenInset, wy + 0.15);
      const screenBR = worldToScreen(vp, monX + monWorldW - screenInset, wy + 0.15);
      const screenW = screenBR.x - screenBL.x;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(screenBL.x, screenBL.y - monElev - 2);
      ctx.lineTo(screenBR.x, screenBR.y - monElev - 2);
      ctx.lineTo(screenBR.x, screenBR.y - monElev - 2 - screenH);
      ctx.lineTo(screenBL.x, screenBL.y - monElev - 2 - screenH);
      ctx.closePath();
      ctx.clip();

      const colors = ["#61afef", "#98c379", "#e5c07b", "#c678dd", "#e06c75"];
      for (let j = 0; j < 5; j++) {
        const lw = 3 + ((time * 4 + j * 3 + i * 7) % 12);
        ctx.fillStyle = colors[(j + i) % colors.length];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(screenBL.x + 2, screenBL.y - monElev - screenH + j * 3 + 4, Math.min(lw, screenW - 4), 1.5);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Stand
    const standPos = worldToScreen(vp, monX + monWorldW / 2, wy + 0.15);
    ctx.fillStyle = "#333";
    ctx.fillRect(standPos.x - 2, standPos.y - monElev, 4, 4);
    ctx.fillRect(standPos.x - 4, standPos.y - monElev + 4, 8, 1.5);
  }

  // Mechanical keyboard
  if (active) {
    drawIsoFlatQuad(ctx, vp, wx + 0.74, wy + 0.58, 0.72, 0.2, h + 1, "#2a2a2a");
    drawIsoFlatQuad(ctx, vp, wx + 0.79, wy + 0.61, 0.28, 0.05, h + 2, "#3a3a3a");
    drawIsoFlatQuad(ctx, vp, wx + 1.1, wy + 0.65, 0.28, 0.05, h + 2, "#3a3a3a");
  }

  // Coffee mug
  const mugPos = worldToScreen(vp, wx + 1.8, wy + 0.8);
  ctx.fillStyle = "#f5f3f0";
  ctx.beginPath();
  ctx.roundRect(mugPos.x, mugPos.y - h - 6, 5, 6, 1);
  ctx.fill();
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.arc(mugPos.x + 6, mugPos.y - h - 3, 2.5, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
}

function drawDesignStudio(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  active: boolean,
  time: number
) {
  // Standing desk (taller, thinner legs implied by block height)
  drawIsoBlock(ctx, vp, wx, wy, 1.8, vp.cellSize * 0.85, 1, {
    top: "#e0d8cc",
    front: "#c8c0b4",
    side: "#d0c8bc",
  });

  const h = vp.cellSize * 0.85;
  const tabPos = worldToScreen(vp, wx + 0.3, wy + 0.2);

  // Cintiq/tablet on arm mount
  const tw = vp.cellSize * 0.8;
  const th = vp.cellSize * 0.55;
  const tx = tabPos.x + vp.cellSize * 0.1;
  const ty = tabPos.y - h;

  // Arm mount
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx + tw / 2, ty);
  ctx.lineTo(tx + tw / 2, ty + 8);
  ctx.stroke();

  // Tablet tilted slightly
  ctx.save();
  ctx.translate(tx + tw / 2, ty - th / 2);
  ctx.rotate(-0.08);

  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, 3);
  ctx.fill();

  // Screen
  ctx.fillStyle = active ? "#f8f0ff" : "#181818";
  ctx.fillRect(-tw / 2 + 3, -th / 2 + 3, tw - 6, th - 6);

  // Design content when active
  if (active) {
    // Color swatches
    const swatches = ["#9b7ed8", "#4a6fd8", "#3d9a6a", "#c45a3c", "#e8c547"];
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-tw / 2 + 8 + i * 7, th / 2 - 8, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = swatches[i];
      ctx.fill();
    }

    // Drawing strokes
    ctx.strokeStyle = "#9b7ed8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-tw / 4, -th / 4);
    ctx.quadraticCurveTo(0, -th / 4 + Math.sin(time * 2) * 4, tw / 4, -th / 4 - 2);
    ctx.stroke();
    ctx.strokeStyle = "#4a6fd8";
    ctx.beginPath();
    ctx.moveTo(-tw / 4 + 3, -th / 4 + 6);
    ctx.quadraticCurveTo(2, -th / 4 + 8 + Math.cos(time * 1.5) * 3, tw / 4 - 3, -th / 4 + 5);
    ctx.stroke();
  }

  ctx.restore();

  // Stylus beside tablet
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx + tw + 4, ty - th + 2);
  ctx.lineTo(tx + tw + 1, ty - 2);
  ctx.stroke();
}

function drawInspectionBay(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  active: boolean,
  state: FactoryState
) {
  // Wood desk
  drawIsoBlock(ctx, vp, wx, wy, 2, vp.cellSize * 0.7, 1.2, {
    top: E.deskTop,
    front: E.deskFront,
    side: E.deskSide,
  });

  const h = vp.cellSize * 0.7;

  // Ultrawide monitor — wall quad on back wall plane
  const uwWorldW = 1.6;
  const uwH = vp.cellSize * 0.45;
  const uwElev = h + 4;
  const uwX = wx + 0.2;
  const uwY = wy + 0.15;

  // Monitor frame
  drawWallQuad(ctx, vp, uwX, uwY, uwWorldW, uwH, "back", uwElev, "#1a1a1a");

  // Screen inset
  const uwScreenH = uwH - 6;
  drawWallQuad(ctx, vp, uwX + 0.05, uwY, uwWorldW - 0.1, uwScreenH, "back", uwElev + 3, active ? "#1e2127" : E.screenOff);

  // Diff lines when active — clipped to screen quad
  if (active) {
    const scrBL = worldToScreen(vp, uwX + 0.05, uwY);
    const scrBR = worldToScreen(vp, uwX + uwWorldW - 0.05, uwY);
    const scrW = scrBR.x - scrBL.x;
    const scrTopY = scrBL.y - uwElev - uwScreenH;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(scrBL.x, scrBL.y - uwElev - 3);
    ctx.lineTo(scrBR.x, scrBR.y - uwElev - 3);
    ctx.lineTo(scrBR.x, scrBR.y - uwElev - 3 - uwScreenH);
    ctx.lineTo(scrBL.x, scrBL.y - uwElev - 3 - uwScreenH);
    ctx.closePath();
    ctx.clip();

    for (let i = 0; i < 7; i++) {
      const isAdd = i % 3 !== 0;
      ctx.fillStyle = isAdd ? "rgba(98,199,121,0.5)" : "rgba(224,108,117,0.4)";
      ctx.fillRect(scrBL.x + 3, scrTopY + 5 + i * 3.5, scrW * 0.6, 2);
    }

    // PR badge
    ctx.fillStyle = "#3d9a6a";
    ctx.beginPath();
    ctx.roundRect(scrBL.x + scrW - 22, scrTopY + 5, 18, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.max(6, vp.cellSize * 0.2)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`#${state.output.prCount || 42}`, scrBL.x + scrW - 13, scrTopY + 13);
    ctx.restore();
  }

  // Monitor stand
  const standCenter = worldToScreen(vp, uwX + uwWorldW / 2, uwY);
  ctx.fillStyle = "#333";
  ctx.fillRect(standCenter.x - 3, standCenter.y - uwElev, 6, 4);
  ctx.fillRect(standCenter.x - 8, standCenter.y - uwElev + 4, 16, 2);

  // Documents with checkmark
  if (active) {
    drawIsoFlatQuad(ctx, vp, wx + 1.42, wy + 0.74, 0.28, 0.2, h + 1, "#fff");
    drawIsoFlatQuad(ctx, vp, wx + 1.46, wy + 0.78, 0.18, 0.03, h + 2, "#ddd");
    drawIsoFlatQuad(ctx, vp, wx + 1.48, wy + 0.84, 0.16, 0.03, h + 2, "#ddd");
    drawIsoFlatQuad(ctx, vp, wx + 1.5, wy + 0.9, 0.14, 0.03, h + 2, "#ddd");
    // Red pen
    const docPos = worldToScreen(vp, wx + 1.5, wy + 0.8);
    ctx.strokeStyle = "#c45a3c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(docPos.x + 12, docPos.y - h - 3);
    ctx.lineTo(docPos.x + 10, docPos.y - h + 8);
    ctx.stroke();
  }
}

function drawLaunchPad(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  active: boolean,
  time: number,
  state: FactoryState
) {
  // Dark tech console
  drawIsoBlock(ctx, vp, wx, wy, 2, vp.cellSize * 0.6, 1.4, {
    top: E.darkTop,
    front: E.darkFront,
    side: E.darkSide,
  });

  const h = vp.cellSize * 0.6;

  // 4 small status monitors — wall quads in a 2x2 grid on back wall
  const smWorldW = 0.5;
  const smH = vp.cellSize * 0.25;
  const smElev = h + 2;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const smX = wx + 0.15 + col * (smWorldW + 0.08);
    const smRowElev = smElev + (1 - row) * (smH + 4); // top row higher

    // Monitor frame
    drawWallQuad(ctx, vp, smX, wy + 0.15, smWorldW, smH, "back", smRowElev, "#1a1a1a");

    // Status LED
    const ledColor = active
      ? ["#3d9a6a", "#4a6fd8", "#e8c547", "#c45a3c"][i]
      : "#333";
    const smBR = worldToScreen(vp, smX + smWorldW, wy + 0.15);
    const ledX = smBR.x - 4;
    const ledY = smBR.y - smRowElev - smH + 4;
    ctx.beginPath();
    ctx.arc(ledX, ledY, 2, 0, Math.PI * 2);
    ctx.fillStyle = ledColor;
    ctx.fill();
    if (active) {
      ctx.beginPath();
      ctx.arc(ledX, ledY, 4, 0, Math.PI * 2);
      ctx.fillStyle = ledColor;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Big red SHIP button
  const btnPos = worldToScreen(vp, wx + 1, wy + 1);
  const btnY = btnPos.y - h + 2;
  const isLaunching = state.agents.deployer.state === "working";
  const pulse = active ? Math.sin(time * 4) * 1.5 : 0;

  // Glow rings
  if (isLaunching) {
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      ctx.arc(btnPos.x, btnY, 10 + r * 4 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = "#ff3333";
      ctx.globalAlpha = 0.15 - r * 0.04;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Button
  ctx.beginPath();
  ctx.arc(btnPos.x, btnY, 6 + pulse, 0, Math.PI * 2);
  ctx.fillStyle = isLaunching ? "#ff3333" : active ? "#cc2222" : "#662222";
  ctx.fill();

  // SHIP text
  if (active) {
    ctx.font = `700 ${Math.max(5, vp.cellSize * 0.15)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText("SHIP", btnPos.x, btnY + 1.5);
  }
}

// ── Ambient Objects ───────────────────────────────────────

export function drawAmbientObjects(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  time: number,
  state: FactoryState
) {
  // Bookshelf (left side, back area)
  drawBookshelf(ctx, vp, 0.3, 1);

  // Coffee machine (left side, front area)
  drawCoffeeMachine(ctx, vp, 0.5, 8.5, time);

  // Kanban board (left wall area)
  drawKanbanBoard(ctx, vp, 0.2, 4.5, state);

  // Server rack (right side)
  drawServerRack(ctx, vp, 11.5, 3, time);

  // Potted plant (front area)
  drawPottedPlant(ctx, vp, 5, 9);

  // Clock on back wall
  drawClock(ctx, vp, time, state);
}

export function getCoffeeMachineSteamAnchor(vp: IsoViewport): { x: number; y: number } {
  const pos = worldToScreen(vp, 0.7, 8.65);
  const h = vp.cellSize * 0.5;
  return {
    x: pos.x + vp.cellSize * 0.08,
    y: pos.y - h - 10,
  };
}

function drawBookshelf(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number
) {
  // Shelf block
  drawIsoBlock(ctx, vp, wx, wy, 1.2, vp.cellSize * 1.3, 0.5, {
    top: E.woodLight,
    front: E.wood,
    side: E.woodDark,
  });

  const shelfFrontY = wy + 0.5;
  const h = vp.cellSize * 1.3;

  // Book spines
  const bookColors = [
    "#c45a3c", "#4a6fd8", "#3d9a6a", "#9b7ed8", "#e8c547",
    "#2d2d2d", "#c45a3c", "#4a6fd8",
  ];
  const ledgeStart = worldToScreen(vp, wx + 0.08, shelfFrontY);
  const ledgeEnd = worldToScreen(vp, wx + 1.12, shelfFrontY);

  for (const lift of [h * 0.28, h * 0.62]) {
    ctx.strokeStyle = "rgba(120, 92, 64, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ledgeStart.x, ledgeStart.y - lift);
    ctx.lineTo(ledgeEnd.x, ledgeEnd.y - lift);
    ctx.stroke();
  }

  for (let shelf = 0; shelf < 2; shelf++) {
    let bookWx = wx + 0.12;
    const lift = shelf === 0 ? h * 0.16 : h * 0.5;
    for (let i = 0; i < 4; i++) {
      const seed = shelf * 4 + i + 1;
      const worldWidth = 0.11 + (Math.sin(seed * 7.31) * 0.5 + 0.5) * 0.09;
      const bh = h * 0.3 - (Math.sin(seed * 3.17) * 0.5 + 0.5) * 4;
      const bookQuad = getScreenQuadFromEdge(
        worldToScreen(vp, bookWx, shelfFrontY),
        worldToScreen(vp, bookWx + worldWidth, shelfFrontY),
        lift,
        bh
      );
      fillQuad(ctx, bookQuad, bookColors[(shelf * 4 + i) % bookColors.length]);
      strokeQuad(ctx, bookQuad, "rgba(40, 40, 40, 0.12)", 0.5);
      bookWx += worldWidth + 0.03;
    }
  }

  // Tiny succulent on top
  drawIsoBlock(ctx, vp, wx + 0.44, wy + 0.18, 0.14, vp.cellSize * 0.14, 0.14, {
    top: "#9a7551",
    front: "#875f3d",
    side: "#7a5534",
  });
  const topPos = worldToScreen(vp, wx + 0.51, wy + 0.25);
  for (const leaf of [-0.8, -0.1, 0.55]) {
    ctx.strokeStyle = "#6b8c5a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(topPos.x, topPos.y - h - 3);
    ctx.lineTo(
      topPos.x + Math.sin(leaf) * 5,
      topPos.y - h - 8 - Math.cos(leaf) * 3
    );
    ctx.stroke();
  }
}

function drawCoffeeMachine(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  _time: number
) {
  drawIsoBlock(ctx, vp, wx, wy, 0.8, vp.cellSize * 0.5, 0.6, {
    top: "#444",
    front: "#333",
    side: "#3a3a3a",
  });

  const pos = worldToScreen(vp, wx + 0.2, wy + 0.15);
  const h = vp.cellSize * 0.5;
  const displayQuad = getScreenQuadFromEdge(
    worldToScreen(vp, wx + 0.08, wy + 0.6),
    worldToScreen(vp, wx + 0.32, wy + 0.6),
    h * 0.28,
    vp.cellSize * 0.11
  );

  // Display
  fillQuad(ctx, displayQuad, "#2d5a2d");
  const innerDisplay = getScreenQuadFromEdge(
    worldToScreen(vp, wx + 0.11, wy + 0.6),
    worldToScreen(vp, wx + 0.29, wy + 0.6),
    h * 0.29,
    vp.cellSize * 0.05
  );
  fillQuad(ctx, innerDisplay, "#5aff5a");

  // Brew button
  ctx.fillStyle = "#3d9a6a";
  ctx.beginPath();
  ctx.ellipse(pos.x + vp.cellSize * 0.35, pos.y - h + 3, 2.4, 1.8, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawKanbanBoard(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  state: FactoryState
) {
  // Kanban board — on left wall plane (extends along y-axis at wx)
  const kbWorldW = 2.5; // world units along y-axis
  const kbH = vp.cellSize * 1;
  const kbElev = vp.cellSize * 0.3;

  // Board background
  drawWallQuad(ctx, vp, wx, wy, kbWorldW, kbH, "left", kbElev, "#f5f0e8");
  strokeWallQuad(ctx, vp, wx, wy, kbWorldW, kbH, "left", kbElev, "#c4bbb0", 1);

  // Clip overlay content to the wall quad shape
  const kbBL = worldToScreen(vp, wx, wy);
  const kbBR = worldToScreen(vp, wx, wy + kbWorldW);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(kbBL.x, kbBL.y - kbElev);
  ctx.lineTo(kbBR.x, kbBR.y - kbElev);
  ctx.lineTo(kbBR.x, kbBR.y - kbElev - kbH);
  ctx.lineTo(kbBL.x, kbBL.y - kbElev - kbH);
  ctx.closePath();
  ctx.clip();

  // Content layout uses the clipped region — flat content is safe inside clip
  const kbScreenW = Math.abs(kbBR.x - kbBL.x);
  const kbLeftX = Math.min(kbBL.x, kbBR.x);
  const kbTopY = Math.min(kbBL.y, kbBR.y) - kbElev - kbH;

  // Column headers
  const cols = ["TODO", "WIP", "DONE"];
  const colW = kbScreenW / 3;
  ctx.font = `600 ${Math.max(5, vp.cellSize * 0.13)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#8e877f";
  for (let i = 0; i < 3; i++) {
    ctx.fillText(cols[i], kbLeftX + colW * i + colW / 2, kbTopY + 8);
    if (i > 0) {
      ctx.strokeStyle = "#ddd8d1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(kbLeftX + colW * i, kbTopY + 2);
      ctx.lineTo(kbLeftX + colW * i, kbTopY + kbH - 2);
      ctx.stroke();
    }
  }

  // Sticky notes in columns
  const noteColors = ["#fff3b0", "#b0e0ff", "#ffb0b0", "#b0ffb0"];
  const cardW = colW * 0.7;
  const cardH = kbH * 0.15;

  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = noteColors[i];
    ctx.fillRect(
      kbLeftX + colW * 0 + (colW - cardW) / 2,
      kbTopY + 13 + i * (cardH + 2),
      cardW,
      cardH
    );
  }

  ctx.fillStyle = noteColors[2];
  ctx.fillRect(
    kbLeftX + colW * 1 + (colW - cardW) / 2,
    kbTopY + 13,
    cardW,
    cardH
  );

  const doneCount = Math.min(state.output.prCount, 3);
  for (let i = 0; i < doneCount; i++) {
    ctx.fillStyle = noteColors[3];
    ctx.fillRect(
      kbLeftX + colW * 2 + (colW - cardW) / 2,
      kbTopY + 13 + i * (cardH + 2),
      cardW,
      cardH
    );
    ctx.strokeStyle = "#3d9a6a";
    ctx.lineWidth = 1;
    const ccx = kbLeftX + colW * 2 + colW / 2;
    const ccy = kbTopY + 13 + i * (cardH + 2) + cardH / 2;
    ctx.beginPath();
    ctx.moveTo(ccx - 2, ccy);
    ctx.lineTo(ccx, ccy + 2);
    ctx.lineTo(ccx + 3, ccy - 2);
    ctx.stroke();
  }

  ctx.restore(); // remove clip
}

function drawServerRack(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  time: number
) {
  drawIsoBlock(ctx, vp, wx, wy, 0.8, vp.cellSize * 1.1, 0.6, {
    top: "#444",
    front: "#2a2a2a",
    side: "#333",
  });
  const h = vp.cellSize * 1.1;
  const rackFaceY = wy + 0.6;

  // Drive bays
  for (let i = 0; i < 4; i++) {
    const slotLift = h * 0.14 + i * (h * 0.19);
    const slotHeight = h * 0.12;
    const slotQuad = getScreenQuadFromEdge(
      worldToScreen(vp, wx + 0.12, rackFaceY),
      worldToScreen(vp, wx + 0.5, rackFaceY),
      slotLift,
      slotHeight
    );
    fillQuad(ctx, slotQuad, "#1a1a1a");

    // Blinking LEDs
    const phase = Math.sin(time * 3 + i * 1.7);
    const ledQuad = getScreenQuadFromEdge(
      worldToScreen(vp, wx + 0.44, rackFaceY),
      worldToScreen(vp, wx + 0.49, rackFaceY),
      slotLift + slotHeight * 0.28,
      slotHeight * 0.34
    );
    fillQuad(ctx, ledQuad, phase > 0 ? "#3d9a6a" : "#1a3a1a");
    if (phase > 0) {
      const glowBounds = quadBounds(ledQuad);
      ctx.fillStyle = "rgba(61,154,106,0.18)";
      ctx.beginPath();
      ctx.ellipse(
        (glowBounds.minX + glowBounds.maxX) / 2,
        (glowBounds.minY + glowBounds.maxY) / 2,
        4,
        2.5,
        0.15,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
}

function drawPottedPlant(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number
) {
  drawIsoBlock(ctx, vp, wx - 0.18, wy - 0.16, 0.36, vp.cellSize * 0.22, 0.32, {
    top: "#c37a4d",
    front: "#b8724a",
    side: "#9f643f",
  });
  const pos = worldToScreen(vp, wx, wy);

  const stemOriginY = pos.y - vp.cellSize * 0.22 - 3;

  // Leaves
  const leaves = [
    { angle: -0.8, len: 14 },
    { angle: -0.3, len: 18 },
    { angle: 0.1, len: 16 },
    { angle: 0.5, len: 15 },
    { angle: 0.9, len: 13 },
    { angle: -1.1, len: 10 },
    { angle: 1.2, len: 11 },
  ];

  for (const leaf of leaves) {
    const tx = pos.x + Math.sin(leaf.angle) * leaf.len;
    const ty = stemOriginY - 2 - Math.cos(leaf.angle) * leaf.len;
    ctx.strokeStyle = "#4a7a3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, stemOriginY);
    ctx.quadraticCurveTo(
      pos.x + Math.sin(leaf.angle) * leaf.len * 0.5,
      stemOriginY - 2 - Math.cos(leaf.angle) * leaf.len * 0.7,
      tx,
      ty
    );
    ctx.stroke();

    // Leaf shape
    ctx.fillStyle = "#5a8a4a";
    ctx.beginPath();
    ctx.ellipse(tx, ty, 4, 2, leaf.angle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClock(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  time: number,
  state: FactoryState
) {
  // Clock — x from back-wall projection, y near top of canvas
  const clockWallPos = worldToScreen(vp, ROOM_W - 1.5, 0);
  const cx = clockWallPos.x;
  const cy = vp.canvasH * 0.06;
  const r = vp.cellSize * 0.4;
  const clockScaleX = 0.9;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(clockScaleX, 1);

  // Face
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#c4bbb0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * (r - 3), Math.sin(angle) * (r - 3));
    ctx.lineTo(Math.cos(angle) * (r - 1), Math.sin(angle) * (r - 1));
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Hands based on elapsed time or default 2:30 PM
  const elapsed = state.elapsedMs / 1000;
  const minutes = elapsed > 0 ? (elapsed / 60) % 60 : 30;
  const hours = elapsed > 0 ? (elapsed / 3600) % 12 : 2;

  const hourAngle = (hours / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(hourAngle) * r * 0.5, Math.sin(hourAngle) * r * 0.5);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(minAngle) * r * 0.7, Math.sin(minAngle) * r * 0.7);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#333";
  ctx.fill();
  ctx.restore();
}

// ── Atmosphere ────────────────────────────────────────────

export function drawSunbeam(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  time: number
) {
  // Derive from shared window anchors
  const anchors = computeRoomAnchors(vp);
  const { x: wx, y: _wy, w: ww, h: wh } = anchors.window;
  const winBottom = anchors.window.y + wh;

  // Sunbeam polygon from window to floor
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wx + ww * 0.4, winBottom + 4);
  ctx.lineTo(wx + ww * 0.9, winBottom + 4);
  ctx.lineTo(wx + ww * 1.1, vp.canvasH * 0.85);
  ctx.lineTo(wx + ww * 0.1, vp.canvasH * 0.75);
  ctx.closePath();

  const grad = ctx.createLinearGradient(
    wx + ww * 0.5,
    winBottom,
    wx + ww * 0.5,
    vp.canvasH * 0.8
  );
  grad.addColorStop(0, "rgba(255,220,150,0.06)");
  grad.addColorStop(0.5, "rgba(255,220,150,0.04)");
  grad.addColorStop(1, "rgba(255,220,150,0)");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport
) {
  const grad = ctx.createRadialGradient(
    vp.canvasW / 2,
    vp.canvasH / 2,
    vp.canvasW * 0.35,
    vp.canvasW / 2,
    vp.canvasH / 2,
    vp.canvasW * 0.7
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vp.canvasW, vp.canvasH);
}

// ── Dust motes in sunbeam ─────────────────────────────────

export function drawDustMotes(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  time: number
) {
  // Derive from shared window anchors — dust floats in the sunbeam area
  const anchors = computeRoomAnchors(vp);
  const { x: wx, w: ww, h: wh } = anchors.window;
  const beamCenterX = wx + ww * 0.65;
  const beamCenterY = anchors.window.y + wh + (vp.canvasH * 0.5 - anchors.window.y - wh) * 0.6;

  for (let i = 0; i < 8; i++) {
    const seed = i * 137.508;
    const px = beamCenterX + Math.sin(seed + time * 0.2) * 60;
    const py = beamCenterY + Math.cos(seed * 0.7 + time * 0.15) * 80;
    const size = 1 + (seed % 1.5);
    const alpha = 0.08 + Math.sin(time * 0.5 + seed) * 0.04;

    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = "#d4a574";
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
