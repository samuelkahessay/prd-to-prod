"use client";

import { useRef, useEffect, useCallback } from "react";
import type { FactoryState, AgentId, CharacterState } from "../factory-types";
import { ALL_AGENTS, AGENT_WORKSTATION } from "../factory-types";
import {
  createViewport,
  drawIsoFloor,
  worldToScreen,
  WORLD_STATIONS,
} from "./isometric";
import {
  drawBackdrop,
  drawAllFurniture,
  drawAmbientObjects,
  drawSunbeam,
  drawVignette,
  drawDustMotes,
} from "./environment";
import { drawCharacter, drawSpeechBubble } from "./characters-v2";
import { IdleBehaviorManager } from "./idle-behaviors";
import { MovementSystem } from "./movement";
import { ParticleSystem } from "./particles";

interface FactoryCanvasProps {
  state: FactoryState;
  height?: number;
}

const C = {
  bg: "#f5f3f0",
  good: "#3d9a6a",
};

function getSpeechBubble(
  state: FactoryState,
  agentId: AgentId,
  time: number
): string | null {
  const agent = state.agents[agentId];
  if (agent.state === "idle") return null;

  const cycle = Math.floor(time * 0.25) % 6;
  if (cycle > 2) return null;

  if (agent.state === "celebrating") return "🎉";
  if (agent.state === "blocked") return "⏳ Waiting...";

  if (agentId === "planner" && agent.state === "working") {
    return agent.currentTask?.includes("Creating") ? "Setting up..." : "Planning...";
  }
  if (agentId === "developer" && agent.state === "working") return "Building...";
  if (agentId === "frontend-designer" && agent.state === "working") return "Designing...";
  if (agentId === "reviewer" && agent.state === "working") return "Reviewing PR...";
  if (agentId === "deployer" && agent.state === "working") return "3... 2... 1...";

  return null;
}

export function FactoryCanvas({ state, height = 420 }: FactoryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Rendering-internal systems (not tied to React state)
  const idleRef = useRef<IdleBehaviorManager | null>(null);
  const moveRef = useRef<MovementSystem | null>(null);
  const particleRef = useRef<ParticleSystem | null>(null);
  const lastTimeRef = useRef(0);
  const initRef = useRef(false);
  const prevAgentStates = useRef(new Map<AgentId, CharacterState>());
  const prevAmbient = useRef(state.ambient);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const time = timestamp / 1000;
    const deltaTime = lastTimeRef.current > 0 ? Math.min(time - lastTimeRef.current, 0.1) : 0.016;
    lastTimeRef.current = time;

    const s = stateRef.current;

    // Lazy-init systems (avoids SSR issues with window access)
    if (!idleRef.current) idleRef.current = new IdleBehaviorManager();
    if (!moveRef.current) moveRef.current = new MovementSystem();
    if (!particleRef.current) particleRef.current = new ParticleSystem();

    const idle = idleRef.current;
    const move = moveRef.current;
    const particles = particleRef.current;

    // Initialize home positions once
    if (!initRef.current) {
      for (const agentId of ALL_AGENTS) {
        const ws = WORLD_STATIONS[AGENT_WORKSTATION[agentId]];
        move.setHome(agentId, ws.x + 0.8, ws.y + 0.5);
      }
      initRef.current = true;
    }

    // DPR scaling
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const vp = createViewport(w, h);

    // ── Update systems ──

    for (const agentId of ALL_AGENTS) {
      const curr = s.agents[agentId].state;
      const prev = prevAgentStates.current.get(agentId);

      idle.update(agentId, curr, deltaTime);

      // Movement triggers on state transitions
      if (prev !== undefined && curr !== prev) {
        if (agentId === "reviewer" && curr === "working") {
          // Reviewer walks to developer's station
          const devWs = WORLD_STATIONS["code-forge"];
          move.moveTo("reviewer", devWs.x + 1.5, devWs.y + 0.5);
        } else if (agentId === "reviewer" && prev === "working" && curr === "idle") {
          move.returnHome("reviewer");
        }

        if (curr === "celebrating") {
          // All celebrating characters walk to center
          move.moveTo(agentId, 5.5, 5);
        } else if (prev === "celebrating") {
          move.returnHome(agentId);
        }
      }

      prevAgentStates.current.set(agentId, curr);
    }

    // Celebration confetti burst
    if (s.ambient === "celebrating" && prevAmbient.current !== "celebrating") {
      const center = worldToScreen(vp, 5.5, 5);
      particles.emitConfetti(center.x, center.y, 40);
    }
    // Periodic confetti during celebration
    if (s.ambient === "celebrating") {
      const sec = Math.floor(time);
      const prevSec = Math.floor(time - deltaTime);
      if (sec !== prevSec && sec % 3 === 0) {
        const center = worldToScreen(vp, 5.5, 5);
        particles.emitConfetti(center.x, center.y, 15);
      }
    }
    prevAmbient.current = s.ambient;

    move.update(deltaTime);
    particles.update(deltaTime);

    // ── Draw ──

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // Backdrop (window, pendant lamps, back wall)
    drawBackdrop(ctx, vp, time);

    // Isometric floor
    drawIsoFloor(ctx, vp);

    // Sunbeam (behind furniture, on floor)
    drawSunbeam(ctx, vp, time);

    // Dust motes floating in sunbeam
    drawDustMotes(ctx, vp, time);

    // Ambient objects (bookshelf, kanban, server rack, etc.)
    drawAmbientObjects(ctx, vp, time, s);

    // Workstation furniture (sorted by y for depth)
    drawAllFurniture(ctx, vp, s, time);

    // Characters (sorted by world y for depth ordering)
    const sortedAgents = [...ALL_AGENTS].sort((a, b) => {
      const posA = move.getPosition(a);
      const posB = move.getPosition(b);
      return posA.y - posB.y;
    });

    const charScale = Math.min(w / 320, 2.2);

    for (const agentId of sortedAgents) {
      const pos = move.getPosition(agentId);
      const screenPos = worldToScreen(vp, pos.x, pos.y);

      drawCharacter(ctx, {
        x: screenPos.x,
        y: screenPos.y - 5,
        scale: charScale,
        state: s.agents[agentId].state,
        time,
        agentId,
        facing: agentId === "reviewer" && !move.isWalking(agentId) ? "left" : "right",
        idle: idle.getIdleState(agentId),
        walking: move.isWalking(agentId),
      });

      // Speech bubbles
      const bubble = getSpeechBubble(s, agentId, time);
      if (bubble) {
        drawSpeechBubble(ctx, screenPos.x, screenPos.y - charScale * 20, bubble, time);
      }
    }

    // Particles (confetti, sparkles, etc.)
    particles.draw(ctx);

    // Celebration banner
    if (s.ambient === "celebrating") {
      ctx.font = `700 ${Math.max(12, w * 0.018)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = C.good;
      ctx.fillText("BUILD COMPLETE", w / 2, h - 20);
    }

    // Vignette (last — sits on top of everything)
    drawVignette(ctx, vp);

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
