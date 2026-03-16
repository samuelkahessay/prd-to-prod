import type { FactoryState, WorkstationId } from "../factory-types";
import {
  IsoViewport,
  worldToScreen,
  drawIsoBlock,
  WORLD_STATIONS,
  ROOM_W,
  ROOM_D,
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

// ── Backdrop (window, lamps) ──────────────────────────────

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  time: number
) {
  const cx = vp.canvasW * 0.42;
  const wy = vp.canvasH * 0.02;
  const ww = vp.canvasW * 0.32;
  const wh = vp.canvasH * 0.28;

  // Back wall hint
  const wallTop = worldToScreen(vp, 0, 0);
  const wallRight = worldToScreen(vp, ROOM_W, 0);
  ctx.fillStyle = E.wallBg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vp.canvasW, 0);
  ctx.lineTo(wallRight.x, wallRight.y);
  ctx.lineTo(wallTop.x, wallTop.y);
  ctx.lineTo(0, wallTop.y * 0.6);
  ctx.closePath();
  ctx.fill();

  // Window frame
  ctx.fillStyle = "#d4ccc0";
  ctx.beginPath();
  ctx.roundRect(cx - 4, wy - 4, ww + 8, wh + 8, 4);
  ctx.fill();

  // Sky gradient inside window
  const skyGrad = ctx.createLinearGradient(cx, wy, cx, wy + wh);
  skyGrad.addColorStop(0, E.skyTop);
  skyGrad.addColorStop(0.6, E.sky);
  skyGrad.addColorStop(1, "#b8dff0");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(cx, wy, ww, wh);

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

  // Window divider cross
  ctx.strokeStyle = "#c4bbb0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + ww / 2, wy);
  ctx.lineTo(cx + ww / 2, wy + wh);
  ctx.moveTo(cx, wy + wh * 0.45);
  ctx.lineTo(cx + ww, wy + wh * 0.45);
  ctx.stroke();

  // Pendant lamps
  drawPendantLamp(ctx, vp.canvasW * 0.22, 0, vp.canvasH * 0.12);
  drawPendantLamp(ctx, vp.canvasW * 0.52, 0, vp.canvasH * 0.1);
  drawPendantLamp(ctx, vp.canvasW * 0.78, 0, vp.canvasH * 0.14);
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

  // Shade (trapezoid)
  ctx.fillStyle = "#c8a86e";
  ctx.beginPath();
  ctx.moveTo(x - 6, lampY);
  ctx.lineTo(x + 6, lampY);
  ctx.lineTo(x + 10, lampY + 8);
  ctx.lineTo(x - 10, lampY + 8);
  ctx.closePath();
  ctx.fill();

  // Warm glow
  const glow = ctx.createRadialGradient(x, lampY + 12, 2, x, lampY + 12, 35);
  glow.addColorStop(0, "rgba(255,220,150,0.1)");
  glow.addColorStop(1, "rgba(255,220,150,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 35, lampY, 70, 50);
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
  time: number,
  state: FactoryState
) {
  // Warm wood desk
  drawIsoBlock(ctx, vp, wx, wy, 2, vp.cellSize * 0.7, 1.2, {
    top: E.deskTop,
    front: E.deskFront,
    side: E.deskSide,
  });

  const deskTop = worldToScreen(vp, wx + 1, wy + 0.6);
  const h = vp.cellSize * 0.7;

  // Whiteboard behind desk (flat rectangle floating above)
  const wbPos = worldToScreen(vp, wx + 0.3, wy - 0.3);
  const wbW = vp.cellSize * 1.4;
  const wbH = vp.cellSize * 1;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#c4bbb0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(wbPos.x, wbPos.y - wbH - h, wbW, wbH, 2);
  ctx.fill();
  ctx.stroke();

  // Sticky notes on whiteboard
  const noteColors = ["#fff3b0", "#b0e0ff", "#ffb0b0", "#b0ffb0"];
  const noteCount = Math.min(state.output.issueCount + 1, 4);
  for (let i = 0; i < noteCount; i++) {
    const nx = wbPos.x + 4 + (i % 2) * (wbW * 0.4);
    const ny = wbPos.y - wbH - h + 4 + Math.floor(i / 2) * (wbH * 0.45);
    ctx.fillStyle = noteColors[i];
    ctx.fillRect(nx, ny, wbW * 0.25, wbH * 0.35);
  }

  // Scattered papers on desk
  if (active) {
    ctx.fillStyle = "#fff";
    ctx.save();
    ctx.translate(deskTop.x - 8, deskTop.y - h - 2);
    ctx.rotate(-0.1);
    ctx.fillRect(0, 0, 10, 13);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, 10, 13);
    ctx.restore();

    ctx.save();
    ctx.translate(deskTop.x + 5, deskTop.y - h - 1);
    ctx.rotate(0.05);
    ctx.fillRect(0, 0, 10, 13);
    ctx.restore();
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
  const monBase = worldToScreen(vp, wx + 0.3, wy + 0.2);

  // Triple monitors
  for (let i = 0; i < 3; i++) {
    const mx = monBase.x + i * vp.cellSize * 0.55;
    const my = monBase.y - h;
    const mw = vp.cellSize * 0.5;
    const mh = vp.cellSize * 0.38;

    // Monitor frame
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.roundRect(mx, my - mh - 4, mw, mh, 2);
    ctx.fill();

    // Screen
    ctx.fillStyle = active ? "#1e2127" : E.screenOff;
    ctx.fillRect(mx + 2, my - mh - 2, mw - 4, mh - 4);

    // Code lines when active
    if (active) {
      const colors = ["#61afef", "#98c379", "#e5c07b", "#c678dd", "#e06c75"];
      for (let j = 0; j < 5; j++) {
        const lw = 3 + ((time * 4 + j * 3 + i * 7) % 12);
        ctx.fillStyle = colors[(j + i) % colors.length];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(mx + 4, my - mh + j * 3 + 2, Math.min(lw, mw - 8), 1.5);
      }
      ctx.globalAlpha = 1;
    }

    // Stand
    ctx.fillStyle = "#333";
    ctx.fillRect(mx + mw / 2 - 2, my - 4, 4, 4);
    ctx.fillRect(mx + mw / 2 - 4, my, 8, 1.5);
  }

  // Mechanical keyboard
  if (active) {
    const kbPos = worldToScreen(vp, wx + 0.8, wy + 0.7);
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.roundRect(kbPos.x, kbPos.y - h - 1, vp.cellSize * 0.8, vp.cellSize * 0.2, 1);
    ctx.fill();
    // Key rows
    ctx.fillStyle = "#3a3a3a";
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillRect(
          kbPos.x + 2 + c * (vp.cellSize * 0.09),
          kbPos.y - h + r * (vp.cellSize * 0.08),
          vp.cellSize * 0.07,
          vp.cellSize * 0.06
        );
      }
    }
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
  const monPos = worldToScreen(vp, wx + 0.3, wy + 0.2);

  // Curved ultrawide monitor
  const mw = vp.cellSize * 1.2;
  const mh = vp.cellSize * 0.45;
  const mx = monPos.x;
  const my = monPos.y - h - mh;

  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 3);
  ctx.fill();

  // Screen content
  ctx.fillStyle = active ? "#1e2127" : E.screenOff;
  ctx.fillRect(mx + 3, my + 3, mw - 6, mh - 6);

  // Diff lines when active
  if (active) {
    for (let i = 0; i < 7; i++) {
      const isAdd = i % 3 !== 0;
      ctx.fillStyle = isAdd ? "rgba(98,199,121,0.5)" : "rgba(224,108,117,0.4)";
      ctx.fillRect(mx + 5, my + 5 + i * 3.5, mw * 0.6, 2);
    }

    // PR badge
    ctx.fillStyle = "#3d9a6a";
    ctx.beginPath();
    ctx.roundRect(mx + mw - 22, my + 5, 18, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.max(6, vp.cellSize * 0.2)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`#${state.output.prCount || 42}`, mx + mw - 13, my + 13);
  }

  // Monitor stand
  ctx.fillStyle = "#333";
  ctx.fillRect(mx + mw / 2 - 3, monPos.y - h - 3, 6, 4);
  ctx.fillRect(mx + mw / 2 - 8, monPos.y - h, 16, 2);

  // Documents with checkmark
  if (active) {
    const docPos = worldToScreen(vp, wx + 1.5, wy + 0.8);
    ctx.fillStyle = "#fff";
    ctx.fillRect(docPos.x, docPos.y - h - 1, 9, 12);
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(docPos.x, docPos.y - h - 1, 9, 12);
    // Text lines
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(docPos.x + 2, docPos.y - h + 1 + i * 2.5, 5, 0.8);
    }
    // Red pen
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
  const consPos = worldToScreen(vp, wx + 0.2, wy + 0.2);

  // 4 small status monitors
  for (let i = 0; i < 4; i++) {
    const smx = consPos.x + (i % 2) * vp.cellSize * 0.55;
    const smy = consPos.y - h - (Math.floor(i / 2) === 0 ? vp.cellSize * 0.35 : 0);
    const smw = vp.cellSize * 0.4;
    const smh = vp.cellSize * 0.25;

    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.roundRect(smx, smy - smh, smw, smh, 1.5);
    ctx.fill();

    // Status LED
    const ledColor = active
      ? ["#3d9a6a", "#4a6fd8", "#e8c547", "#c45a3c"][i]
      : "#333";
    ctx.beginPath();
    ctx.arc(smx + smw - 4, smy - smh + 4, 2, 0, Math.PI * 2);
    ctx.fillStyle = ledColor;
    ctx.fill();
    if (active) {
      ctx.beginPath();
      ctx.arc(smx + smw - 4, smy - smh + 4, 4, 0, Math.PI * 2);
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

  const pos = worldToScreen(vp, wx + 0.1, wy + 0.1);
  const h = vp.cellSize * 1.3;

  // Book spines
  const bookColors = [
    "#c45a3c", "#4a6fd8", "#3d9a6a", "#9b7ed8", "#e8c547",
    "#2d2d2d", "#c45a3c", "#4a6fd8",
  ];
  const shelfW = vp.cellSize * 0.8;

  for (let shelf = 0; shelf < 2; shelf++) {
    const sy = pos.y - h + shelf * (h * 0.45) + 4;
    let bx = pos.x + 2;
    for (let i = 0; i < 4; i++) {
      const bw = 2 + Math.random() * 2;
      const bh = h * 0.3 - Math.random() * 4;
      ctx.fillStyle = bookColors[(shelf * 4 + i) % bookColors.length];
      ctx.fillRect(bx, sy + (h * 0.35 - bh), bw, bh);
      bx += bw + 1;
    }
  }

  // Tiny succulent on top
  const topPos = worldToScreen(vp, wx + 0.5, wy + 0.25);
  ctx.fillStyle = "#6b8c5a";
  ctx.beginPath();
  ctx.arc(topPos.x, topPos.y - h - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8b6c4a";
  ctx.fillRect(topPos.x - 2, topPos.y - h, 4, 3);
}

function drawCoffeeMachine(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  time: number
) {
  drawIsoBlock(ctx, vp, wx, wy, 0.8, vp.cellSize * 0.5, 0.6, {
    top: "#444",
    front: "#333",
    side: "#3a3a3a",
  });

  const pos = worldToScreen(vp, wx + 0.2, wy + 0.15);
  const h = vp.cellSize * 0.5;

  // Display
  ctx.fillStyle = "#2d5a2d";
  ctx.fillRect(pos.x, pos.y - h - 2, vp.cellSize * 0.3, vp.cellSize * 0.12);
  ctx.fillStyle = "#5aff5a";
  ctx.font = `${Math.max(5, vp.cellSize * 0.12)}px monospace`;
  ctx.textAlign = "left";
  ctx.fillText("RDY", pos.x + 2, pos.y - h + 1);

  // Brew button
  ctx.fillStyle = "#3d9a6a";
  ctx.beginPath();
  ctx.arc(pos.x + vp.cellSize * 0.35, pos.y - h + 3, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawKanbanBoard(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number,
  state: FactoryState
) {
  const pos = worldToScreen(vp, wx, wy);
  const bw = vp.cellSize * 1.5;
  const bh = vp.cellSize * 1;

  // Board background
  ctx.fillStyle = "#f5f0e8";
  ctx.strokeStyle = "#c4bbb0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(pos.x, pos.y - bh, bw, bh, 2);
  ctx.fill();
  ctx.stroke();

  // Column headers
  const cols = ["TODO", "WIP", "DONE"];
  const colW = bw / 3;
  ctx.font = `600 ${Math.max(5, vp.cellSize * 0.13)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#8e877f";
  for (let i = 0; i < 3; i++) {
    ctx.fillText(cols[i], pos.x + colW * i + colW / 2, pos.y - bh + 8);
    if (i > 0) {
      ctx.strokeStyle = "#ddd8d1";
      ctx.beginPath();
      ctx.moveTo(pos.x + colW * i, pos.y - bh + 2);
      ctx.lineTo(pos.x + colW * i, pos.y - 2);
      ctx.stroke();
    }
  }

  // Sticky notes in columns
  const noteColors = ["#fff3b0", "#b0e0ff", "#ffb0b0", "#b0ffb0"];
  const cardW = colW * 0.7;
  const cardH = bh * 0.15;

  // TODO cards
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = noteColors[i];
    ctx.fillRect(
      pos.x + colW * 0 + (colW - cardW) / 2,
      pos.y - bh + 13 + i * (cardH + 2),
      cardW,
      cardH
    );
  }

  // WIP card
  ctx.fillStyle = noteColors[2];
  ctx.fillRect(
    pos.x + colW * 1 + (colW - cardW) / 2,
    pos.y - bh + 13,
    cardW,
    cardH
  );

  // DONE cards with checkmarks
  const doneCount = Math.min(state.output.prCount, 3);
  for (let i = 0; i < doneCount; i++) {
    ctx.fillStyle = noteColors[3];
    ctx.fillRect(
      pos.x + colW * 2 + (colW - cardW) / 2,
      pos.y - bh + 13 + i * (cardH + 2),
      cardW,
      cardH
    );
    // Checkmark
    ctx.strokeStyle = "#3d9a6a";
    ctx.lineWidth = 1;
    const cx = pos.x + colW * 2 + colW / 2;
    const cy = pos.y - bh + 13 + i * (cardH + 2) + cardH / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx + 3, cy - 2);
    ctx.stroke();
  }
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

  const pos = worldToScreen(vp, wx + 0.1, wy + 0.1);
  const h = vp.cellSize * 1.1;

  // Drive bays
  for (let i = 0; i < 4; i++) {
    const by = pos.y - h + 4 + i * (h * 0.2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(pos.x, by, vp.cellSize * 0.45, h * 0.15);

    // Blinking LEDs
    const phase = Math.sin(time * 3 + i * 1.7);
    ctx.beginPath();
    ctx.arc(pos.x + vp.cellSize * 0.38, by + h * 0.075, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = phase > 0 ? "#3d9a6a" : "#1a3a1a";
    ctx.fill();
  }
}

function drawPottedPlant(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  wx: number,
  wy: number
) {
  const pos = worldToScreen(vp, wx, wy);

  // Pot
  ctx.fillStyle = "#b8724a";
  ctx.beginPath();
  ctx.moveTo(pos.x - 6, pos.y);
  ctx.lineTo(pos.x + 6, pos.y);
  ctx.lineTo(pos.x + 5, pos.y - 10);
  ctx.lineTo(pos.x - 5, pos.y - 10);
  ctx.closePath();
  ctx.fill();

  // Pot rim
  ctx.fillStyle = "#a8623a";
  ctx.fillRect(pos.x - 6, pos.y - 10, 12, 2);

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
    const ty = pos.y - 12 - Math.cos(leaf.angle) * leaf.len;
    ctx.strokeStyle = "#4a7a3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - 10);
    ctx.quadraticCurveTo(
      pos.x + Math.sin(leaf.angle) * leaf.len * 0.5,
      pos.y - 12 - Math.cos(leaf.angle) * leaf.len * 0.7,
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
  const cx = vp.canvasW * 0.82;
  const cy = vp.canvasH * 0.06;
  const r = vp.cellSize * 0.4;

  // Face
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#c4bbb0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (r - 3), cy + Math.sin(angle) * (r - 3));
    ctx.lineTo(cx + Math.cos(angle) * (r - 1), cy + Math.sin(angle) * (r - 1));
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Hands based on elapsed time or default 2:30 PM
  const elapsed = state.elapsedMs / 1000;
  const minutes = elapsed > 0 ? (elapsed / 60) % 60 : 30;
  const hours = elapsed > 0 ? (elapsed / 3600) % 12 : 2;

  // Hour hand
  const hourAngle = (hours / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hourAngle) * r * 0.5, cy + Math.sin(hourAngle) * r * 0.5);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Minute hand
  const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minAngle) * r * 0.7, cy + Math.sin(minAngle) * r * 0.7);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#333";
  ctx.fill();
}

// ── Atmosphere ────────────────────────────────────────────

export function drawSunbeam(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  time: number
) {
  const wx = vp.canvasW * 0.42;
  const ww = vp.canvasW * 0.32;
  const wh = vp.canvasH * 0.28;

  // Sunbeam polygon from window to floor
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wx + ww * 0.4, wh + 4);
  ctx.lineTo(wx + ww * 0.9, wh + 4);
  ctx.lineTo(wx + ww * 1.1, vp.canvasH * 0.85);
  ctx.lineTo(wx + ww * 0.1, vp.canvasH * 0.75);
  ctx.closePath();

  const grad = ctx.createLinearGradient(
    wx + ww * 0.5,
    wh,
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
  const beamCenterX = vp.canvasW * 0.55;
  const beamCenterY = vp.canvasH * 0.5;

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
