"use client";

import { useRef, useEffect, useCallback } from "react";
import type { FactoryState, AgentId, WorkstationId } from "../factory-types";
import { ALL_AGENTS, AGENT_WORKSTATION } from "../factory-types";
import { drawCharacter, drawSpeechBubble } from "./characters";

interface FactoryCanvasProps {
  state: FactoryState;
  height?: number;
}

const C = {
  bg: "#f5f3f0",
  floor: "#edeae5",
  surface: "#faf9f7",
  ink: "#2b2520",
  inkMid: "#5c554e",
  inkMuted: "#8e877f",
  inkFaint: "#b5afa8",
  rule: "#ddd8d1",
  accent: "#4a6fd8",
  accentWash: "rgba(74,111,216,0.08)",
  good: "#3d9a6a",
  goodWash: "rgba(61,154,106,0.08)",
  heal: "#c45a3c",
  policy: "#9b7ed8",
};

// Workstation positions (normalized 0-1)
const WS: Record<WorkstationId, { x: number; y: number; label: string }> = {
  "blueprint-table": { x: 0.10, y: 0.55, label: "BLUEPRINT" },
  "code-forge":      { x: 0.32, y: 0.40, label: "CODE FORGE" },
  "design-studio":   { x: 0.32, y: 0.75, label: "DESIGN STUDIO" },
  "inspection-bay":  { x: 0.58, y: 0.55, label: "INSPECTION" },
  "launch-pad":      { x: 0.85, y: 0.55, label: "LAUNCH PAD" },
};

// Speech bubble messages based on recent events
function getSpeechBubble(state: FactoryState, agentId: AgentId, time: number): string | null {
  const agent = state.agents[agentId];
  if (agent.state === "idle") return null;

  // Only show bubbles intermittently
  const cycle = Math.floor(time * 0.25) % 6;
  if (cycle > 2) return null;

  if (agent.state === "celebrating") return "🎉";
  if (agent.state === "blocked") return "⏳ Waiting...";

  if (agentId === "planner" && agent.state === "working") {
    return agent.currentTask?.includes("Creating") ? "Setting up..." : "Planning...";
  }
  if (agentId === "developer" && agent.state === "working") {
    return "Building...";
  }
  if (agentId === "frontend-designer" && agent.state === "working") {
    return "Designing...";
  }
  if (agentId === "reviewer" && agent.state === "working") {
    return "Reviewing PR...";
  }
  if (agentId === "deployer" && agent.state === "working") {
    return "3... 2... 1...";
  }

  return null;
}

export function FactoryCanvas({ state, height = 420 }: FactoryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const time = timestamp / 1000;
    const s = stateRef.current;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // Floor
    drawFloor(ctx, w, h);

    // Ambient particles
    drawAmbientParticles(ctx, w, h, time, s);

    // Connection paths between stations
    drawConnectionPaths(ctx, w, h, time, s);

    // Workstation furniture
    for (const wsId of Object.keys(WS) as WorkstationId[]) {
      drawWorkstationFurniture(ctx, w, h, wsId, s, time);
    }

    // Characters at their stations
    for (const agentId of ALL_AGENTS) {
      const agent = s.agents[agentId];
      const wsPos = WS[agent.workstation];
      const charScale = Math.min(w / 300, 2.5);

      drawCharacter(ctx, {
        x: wsPos.x * w,
        y: wsPos.y * h - 10,
        scale: charScale,
        state: agent.state,
        time,
        agentId,
        facing: agentId === "reviewer" ? "left" : "right",
      });

      // Speech bubbles
      const bubble = getSpeechBubble(s, agentId, time);
      if (bubble) {
        drawSpeechBubble(
          ctx,
          wsPos.x * w,
          wsPos.y * h - 55,
          bubble,
          time
        );
      }
    }

    // Output info overlay
    if (s.ambient === "celebrating") {
      drawCelebration(ctx, w, h, time);
    }

    ctx.restore();
    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height,
        display: "block",
        border: "1px solid var(--rule)",
        borderTop: "none",
      }}
    />
  );
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Subtle isometric grid
  ctx.strokeStyle = "rgba(0,0,0,0.03)";
  ctx.lineWidth = 1;

  const spacing = 40;
  for (let i = 0; i < w + h; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - h * 0.5, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i - w, 0);
    ctx.lineTo(i - w + h * 0.5, h);
    ctx.stroke();
  }
}

function drawAmbientParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  state: FactoryState
) {
  const count = state.ambient === "busy" ? 12 : state.ambient === "celebrating" ? 20 : 6;

  for (let i = 0; i < count; i++) {
    const seed = i * 137.508;
    const px = ((seed * 0.618 + time * 8) % w);
    const py = ((seed * 0.381 + time * 3) % h);
    const size = 1 + (seed % 2);
    const alpha = 0.06 + (Math.sin(time + seed) + 1) * 0.04;

    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = state.ambient === "celebrating" ? C.good : C.inkFaint;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawConnectionPaths(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  state: FactoryState
) {
  const connections: [WorkstationId, WorkstationId][] = [
    ["blueprint-table", "code-forge"],
    ["blueprint-table", "design-studio"],
    ["code-forge", "inspection-bay"],
    ["design-studio", "inspection-bay"],
    ["inspection-bay", "launch-pad"],
  ];

  for (const [fromId, toId] of connections) {
    const from = WS[fromId];
    const to = WS[toId];
    const fx = from.x * w;
    const fy = from.y * h;
    const tx = to.x * w;
    const ty = to.y * h;

    // Curved path
    const mx = (fx + tx) / 2;
    const my = (fy + ty) / 2 - 15;

    ctx.beginPath();
    ctx.moveTo(fx + 35, fy);
    ctx.quadraticCurveTo(mx, my, tx - 35, ty);
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated dots when busy
    if (state.ambient === "busy" || state.ambient === "celebrating") {
      const speed = state.ambient === "celebrating" ? 0.3 : 0.15;
      for (let i = 0; i < 2; i++) {
        const t = ((time * speed + i * 0.5) % 1);
        const px = fx + 35 + (tx - 35 - fx - 35) * t;
        const py = fy + (ty - fy) * t + Math.sin(t * Math.PI) * -15;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = C.accent;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawWorkstationFurniture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wsId: WorkstationId,
  state: FactoryState,
  time: number
) {
  const pos = WS[wsId];
  const x = pos.x * w;
  const y = pos.y * h;
  const ws = state.workstations[wsId];
  const isActive = ws.activeAgent !== null;

  // Station label
  ctx.font = "600 8px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.letterSpacing = "0.1em";
  ctx.fillStyle = isActive ? C.inkMid : C.inkFaint;
  ctx.fillText(pos.label, x, y + 28);
  ctx.letterSpacing = "0";

  // Draw station-specific furniture
  switch (wsId) {
    case "blueprint-table":
      drawWhiteboard(ctx, x + 30, y - 30, isActive, time, state);
      break;
    case "code-forge":
      drawMonitors(ctx, x + 25, y - 15, isActive, time);
      break;
    case "design-studio":
      drawTablet(ctx, x + 25, y - 15, isActive, time);
      break;
    case "inspection-bay":
      drawReviewDesk(ctx, x + 25, y - 15, isActive);
      break;
    case "launch-pad":
      drawLaunchConsole(ctx, x + 25, y - 15, isActive, time, state);
      break;
  }
}

function drawWhiteboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  time: number,
  state: FactoryState
) {
  // Board
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 25, 40, 35, 3);
  ctx.fill();
  ctx.stroke();

  // Sticky notes (appear based on issue count)
  const noteCount = Math.min(state.output.issueCount + 1, 4);
  const noteColors = ["#fff3b0", "#b0e0ff", "#ffb0b0", "#b0ffb0"];

  if (active || noteCount > 0) {
    for (let i = 0; i < noteCount; i++) {
      const nx = x - 14 + (i % 2) * 18;
      const ny = y - 20 + Math.floor(i / 2) * 15;
      ctx.fillStyle = noteColors[i % noteColors.length];
      ctx.fillRect(nx, ny, 12, 10);
    }
  }
}

function drawMonitors(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  time: number
) {
  // Dual monitors
  for (let i = 0; i < 2; i++) {
    const mx = x - 18 + i * 20;
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.roundRect(mx, y - 15, 16, 12, 2);
    ctx.fill();

    // Screen glow
    ctx.fillStyle = active ? (i === 0 ? "#1a2d1a" : "#1a1a2d") : "#111";
    ctx.fillRect(mx + 1, y - 14, 14, 10);

    // Code lines when active
    if (active) {
      const lineColor = i === 0 ? "rgba(61,154,106,0.6)" : "rgba(74,111,216,0.6)";
      for (let j = 0; j < 4; j++) {
        const lw = 4 + ((time * 3 + j * 2 + i) % 8);
        ctx.fillStyle = lineColor;
        ctx.fillRect(mx + 3, y - 12 + j * 2.5, Math.min(lw, 10), 1);
      }
    }

    // Stand
    ctx.fillStyle = "#444";
    ctx.fillRect(mx + 6, y - 3, 4, 4);
    ctx.fillRect(mx + 4, y + 1, 8, 1.5);
  }
}

function drawTablet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  time: number
) {
  // Tablet
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.roundRect(x - 12, y - 15, 24, 18, 3);
  ctx.fill();

  // Screen
  ctx.fillStyle = active ? "#f8f0ff" : "#222";
  ctx.fillRect(x - 10, y - 13, 20, 14);

  // Color swatches when active
  if (active) {
    const swatches = ["#9b7ed8", "#4a6fd8", "#3d9a6a", "#c45a3c"];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = swatches[i];
      ctx.fillRect(x - 8 + i * 5, y - 5, 4, 4);
    }

    // Drawing strokes
    ctx.strokeStyle = "#9b7ed8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 11);
    ctx.quadraticCurveTo(x, y - 8 + Math.sin(time * 2) * 2, x + 6, y - 10);
    ctx.stroke();
  }

  // Stylus
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 14, y - 18);
  ctx.lineTo(x + 10, y - 8);
  ctx.stroke();
}

function drawReviewDesk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean
) {
  // Desk with documents
  ctx.fillStyle = "#ddd";
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 5, 30, 15, 2);
  ctx.fill();
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Documents
  if (active) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 10, y - 3, 10, 12);
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 10, y - 3, 10, 12);

    // Lines on document
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#ccc";
      ctx.fillRect(x - 8, y + i * 2.5, 6, 0.8);
    }

    // Checkmark
    ctx.strokeStyle = C.good;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + 6, y + 6);
    ctx.lineTo(x + 12, y - 1);
    ctx.stroke();
  }
}

function drawLaunchConsole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  time: number,
  state: FactoryState
) {
  // Console panel
  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 12, 36, 20, 3);
  ctx.fill();

  // Status lights
  const lights = [C.heal, C.accent, C.good];
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x - 10 + i * 8, y - 6, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = active ? lights[i] : "#444";
    ctx.fill();
    if (active) {
      ctx.beginPath();
      ctx.arc(x - 10 + i * 8, y - 6, 4, 0, Math.PI * 2);
      ctx.fillStyle = lights[i];
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Big red button
  const btnY = y + 2;
  const btnPulse = active ? Math.sin(time * 4) * 1.5 : 0;
  const isLaunching = state.agents.deployer.state === "working";

  ctx.beginPath();
  ctx.arc(x, btnY, 5 + btnPulse, 0, Math.PI * 2);
  ctx.fillStyle = isLaunching ? "#ff3333" : active ? "#cc2222" : "#662222";
  ctx.fill();

  if (isLaunching) {
    ctx.beginPath();
    ctx.arc(x, btnY, 8 + btnPulse, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff3333";
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawCelebration(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  // Confetti
  const confettiColors = [C.accent, C.good, C.policy, C.heal, "#ffd700"];
  for (let i = 0; i < 30; i++) {
    const seed = i * 97.531;
    const cx = (seed * 0.618) % w;
    const cy = ((seed * 0.381 + time * 40) % (h + 20)) - 10;
    const rot = time * (2 + (i % 3)) + seed;
    const size = 3 + (i % 4);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = confettiColors[i % confettiColors.length];
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-size / 2, -1, size, 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // "BUILD COMPLETE" banner
  ctx.font = "700 14px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = C.good;
  ctx.fillText("BUILD COMPLETE", w / 2, h - 20);
}
