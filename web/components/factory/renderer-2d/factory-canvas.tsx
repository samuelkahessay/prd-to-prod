"use client";

import { useRef, useEffect, useCallback } from "react";
import type { MutableRefObject } from "react";
import type {
  AgentId,
  CharacterState,
  FactoryState,
  WorkItem,
} from "../factory-types";
import { ALL_AGENTS } from "../factory-types";
import {
  createViewport,
  drawIsoFloor,
  type IsoViewport,
  worldToScreen,
} from "./isometric";
import {
  drawBackdrop,
  drawAllFurniture,
  drawAmbientObjects,
  drawSunbeam,
  drawVignette,
  drawDustMotes,
  getCoffeeMachineSteamAnchor,
} from "./environment";
import { drawCharacter, drawSpeechBubble } from "./characters-v2";
import { IdleBehaviorManager } from "./idle-behaviors";
import { MovementSystem } from "./movement";
import { ParticleSystem } from "./particles";
import { createSeededRandom } from "./random";
import {
  CENTER_STAGE,
  getAgentHomePosition,
  getCelebrationRoute,
  getDeployerLaunchRoute,
  getEffectAnchor,
  getPlannerKickoffRoute,
  getReviewRoutes,
  getSpeechBubbleText,
  getTransitPath,
  sampleRoutePoint,
  type WorldPoint,
} from "./choreography";
import {
  getFactoryReplaySeed,
  type FactoryReplayProfile,
} from "../factory-replay";

interface FactoryCanvasProps {
  state: FactoryState;
  height?: number;
  replayProfile?: FactoryReplayProfile;
}

interface TransitTrack {
  id: string;
  item: WorkItem;
  path: WorldPoint[];
  progress: number;
  speed: number;
  arrivedAt: number | null;
}

const C = {
  bg: "#f5f3f0",
  good: "#3d9a6a",
};

const ITEM_COLORS: Record<WorkItem["type"], string> = {
  issue: "#c97d52",
  pr: "#3d9a6a",
  deployment: "#4a6fd8",
};

function getSpeechBubble(
  state: FactoryState,
  agentId: AgentId,
  time: number
): string | null {
  const agent = state.agents[agentId];
  const cycle = Math.floor(time * 0.35);

  if (cycle % 6 > 2) {
    return null;
  }

  return getSpeechBubbleText(
    agentId,
    agent.state,
    agent.currentTask,
    cycle
  );
}

export function FactoryCanvas({
  state,
  height = 420,
  replayProfile = "demo",
}: FactoryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const replayProfileRef = useRef(replayProfile);
  replayProfileRef.current = replayProfile;

  const idleRef = useRef<IdleBehaviorManager | null>(null);
  const moveRef = useRef<MovementSystem | null>(null);
  const particleRef = useRef<ParticleSystem | null>(null);
  const transitRef = useRef<Map<string, TransitTrack>>(new Map());
  const effectTimerRef = useRef<Map<AgentId, number>>(new Map());
  const steamTimerRef = useRef(0);
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
    const deltaTime =
      lastTimeRef.current > 0 ? Math.min(time - lastTimeRef.current, 0.1) : 0.016;
    lastTimeRef.current = time;

    const s = stateRef.current;

    if (!idleRef.current) {
      const seed = getFactoryReplaySeed(replayProfileRef.current);
      idleRef.current = new IdleBehaviorManager({
        random: seed === null ? Math.random : createSeededRandom(seed + 11),
      });
    }
    if (!moveRef.current) moveRef.current = new MovementSystem();
    if (!particleRef.current) {
      const seed = getFactoryReplaySeed(replayProfileRef.current);
      particleRef.current = new ParticleSystem({
        random: seed === null ? Math.random : createSeededRandom(seed + 29),
      });
    }

    const idle = idleRef.current;
    const move = moveRef.current;
    const particles = particleRef.current;

    if (!initRef.current) {
      for (const agentId of ALL_AGENTS) {
        const home = getAgentHomePosition(agentId);
        move.setHome(agentId, home.x, home.y);
      }
      initRef.current = true;
    }

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

    syncTransitTracks(s, move, transitRef.current);

    for (const agentId of ALL_AGENTS) {
      const curr = s.agents[agentId].state;
      const prev = prevAgentStates.current.get(agentId);

      idle.update(agentId, curr, deltaTime);
      updateAgentEffectTimer(effectTimerRef.current, agentId, curr, deltaTime);

      if (prev !== undefined && curr !== prev) {
        if (agentId === "planner" && curr === "working") {
          const kickoffRoute = getPlannerKickoffRoute(
            s.agents[agentId].currentTask
          );
          if (kickoffRoute) {
            move.moveAlong(agentId, kickoffRoute);
          }
        }

        if (agentId === "deployer" && curr === "working") {
          move.moveAlong(agentId, getDeployerLaunchRoute());
        } else if (
          prev === "celebrating" &&
          curr !== "celebrating" &&
          curr !== "working" &&
          s.ambient !== "celebrating"
        ) {
          move.returnHome(agentId);
        }

        if (curr === "celebrating" && s.ambient !== "celebrating") {
          emitCelebrationSparkle(agentId, particles, vp);
        }
      }

      maybeEmitWorkEffect(agentId, s.agents[agentId].state, effectTimerRef.current, particles, vp);
      prevAgentStates.current.set(agentId, curr);
    }

    updateTransitAnimations(transitRef.current, deltaTime, time, particles, vp);
    updateCoffeeSteam(s, deltaTime, particles, vp, steamTimerRef);

    if (s.ambient === "celebrating" && prevAmbient.current !== "celebrating") {
      for (const agentId of ALL_AGENTS) {
        move.moveAlong(agentId, getCelebrationRoute(agentId));
      }
      const center = worldToScreen(vp, CENTER_STAGE.x, CENTER_STAGE.y);
      particles.emitConfetti(center.x, center.y, 40);
    } else if (
      prevAmbient.current === "celebrating" &&
      s.ambient !== "celebrating"
    ) {
      for (const agentId of ALL_AGENTS) {
        move.returnHome(agentId);
      }
    }

    if (s.ambient === "celebrating") {
      const sec = Math.floor(time);
      const prevSec = Math.floor(time - deltaTime);
      if (sec !== prevSec && sec % 3 === 0) {
        const center = worldToScreen(vp, CENTER_STAGE.x, CENTER_STAGE.y);
        particles.emitConfetti(center.x, center.y, 15);
      }
    }
    prevAmbient.current = s.ambient;

    move.update(deltaTime);
    particles.update(deltaTime);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    drawBackdrop(ctx, vp, time);
    drawIsoFloor(ctx, vp);
    drawSunbeam(ctx, vp, time);
    drawDustMotes(ctx, vp, time);
    drawAmbientObjects(ctx, vp, time, s);
    drawAllFurniture(ctx, vp, s, time);
    drawTransitTracks(ctx, vp, transitRef.current, time);

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
        facing:
          move.isWalking(agentId) || agentId !== "reviewer"
            ? move.getFacing(agentId)
            : "left",
        idle: idle.getIdleState(agentId),
        walking: move.isWalking(agentId),
      });

      const bubble = getSpeechBubble(s, agentId, time);
      if (bubble) {
        drawSpeechBubble(ctx, screenPos.x, screenPos.y - charScale * 20, bubble, time);
      }
    }

    particles.draw(ctx);

    if (s.ambient === "celebrating") {
      ctx.font = `700 ${Math.max(12, w * 0.018)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = C.good;
      ctx.fillText("BUILD COMPLETE", w / 2, h - 20);
    }

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

function syncTransitTracks(
  state: FactoryState,
  move: MovementSystem,
  tracks: Map<string, TransitTrack>
) {
  for (const conveyorItem of state.conveyor) {
    if (tracks.has(conveyorItem.id)) {
      continue;
    }

    tracks.set(conveyorItem.id, {
      id: conveyorItem.id,
      item: conveyorItem.item,
      path: getTransitPath(conveyorItem.from, conveyorItem.to),
      progress: 0,
      speed: conveyorItem.item.type === "deployment" ? 0.36 : 0.46,
      arrivedAt: null,
    });

    if (conveyorItem.item.type === "pr") {
      const routes = getReviewRoutes(conveyorItem.from);
      if (routes) {
        move.moveAlong(routes.sourceAgent, routes.sourceRoute);
        move.moveAlong("reviewer", routes.reviewerRoute);
      }
    }
  }
}

function updateTransitAnimations(
  tracks: Map<string, TransitTrack>,
  deltaTime: number,
  time: number,
  particles: ParticleSystem,
  vp: IsoViewport
) {
  for (const track of tracks.values()) {
    if (track.arrivedAt !== null) {
      continue;
    }

    track.progress = Math.min(1, track.progress + deltaTime * track.speed);
    if (track.progress >= 1) {
      track.progress = 1;
      track.arrivedAt = time;
      const destination = sampleRoutePoint(track.path, 1);
      const screen = worldToScreen(vp, destination.x, destination.y);
      particles.emitSparkle(screen.x, screen.y - 8, 4);
    }
  }
}

function updateCoffeeSteam(
  state: FactoryState,
  deltaTime: number,
  particles: ParticleSystem,
  vp: IsoViewport,
  steamTimerRef: MutableRefObject<number>
) {
  steamTimerRef.current += deltaTime;

  const interval = state.ambient === "busy" ? 0.18 : 0.42;
  if (steamTimerRef.current < interval) {
    return;
  }

  steamTimerRef.current = 0;
  const steamOrigin = getCoffeeMachineSteamAnchor(vp);
  particles.emitSteam(
    steamOrigin.x,
    steamOrigin.y,
    state.ambient === "busy" ? 3 : 1
  );
}

function updateAgentEffectTimer(
  timers: Map<AgentId, number>,
  agentId: AgentId,
  state: CharacterState,
  deltaTime: number
) {
  if (state !== "working") {
    timers.set(agentId, 0);
    return;
  }

  const current = timers.get(agentId) ?? 0;
  timers.set(agentId, current + deltaTime);
}

function maybeEmitWorkEffect(
  agentId: AgentId,
  state: CharacterState,
  timers: Map<AgentId, number>,
  particles: ParticleSystem,
  vp: IsoViewport
) {
  if (state !== "working") {
    return;
  }

  const interval =
    agentId === "deployer" ? 0.95 : agentId === "planner" ? 1.2 : 0.75;
  const elapsed = timers.get(agentId) ?? 0;
  if (elapsed < interval) {
    return;
  }

  timers.set(agentId, 0);
  const anchor = getEffectAnchor(agentId);
  const screen = worldToScreen(vp, anchor.x, anchor.y);

  if (agentId === "frontend-designer" || agentId === "deployer") {
    particles.emitSparkle(screen.x, screen.y - 8, agentId === "deployer" ? 5 : 3);
    return;
  }

  particles.emitCode(
    screen.x,
    screen.y - 4,
    agentId === "planner" ? "#c97d52" : "#61afef"
  );
}

function emitCelebrationSparkle(
  agentId: AgentId,
  particles: ParticleSystem,
  vp: IsoViewport
) {
  const anchor = getEffectAnchor(agentId);
  const screen = worldToScreen(vp, anchor.x, anchor.y);
  particles.emitSparkle(screen.x, screen.y - 8, 4);
}

function drawTransitTracks(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  tracks: Map<string, TransitTrack>,
  time: number
) {
  for (const track of tracks.values()) {
    const fadeAlpha =
      track.arrivedAt === null
        ? 1
        : Math.max(0, 1 - Math.min(0.6, time - track.arrivedAt) / 0.6);
    if (fadeAlpha <= 0) {
      continue;
    }

    drawTransitPath(ctx, vp, track.path, fadeAlpha);
    drawTransitPayload(ctx, vp, track, fadeAlpha);
  }
}

function drawTransitPath(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  path: WorldPoint[],
  alpha: number
) {
  if (path.length < 2) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = `rgba(104, 96, 87, ${0.18 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();

  path.forEach((point, index) => {
    const screen = worldToScreen(vp, point.x, point.y);
    if (index === 0) {
      ctx.moveTo(screen.x, screen.y);
      return;
    }
    ctx.lineTo(screen.x, screen.y);
  });

  ctx.stroke();
  ctx.restore();
}

function drawTransitPayload(
  ctx: CanvasRenderingContext2D,
  vp: IsoViewport,
  track: TransitTrack,
  alpha: number
) {
  const point = sampleRoutePoint(track.path, track.progress);
  const screen = worldToScreen(vp, point.x, point.y);
  const label = getTransitLabel(track.item.type);
  const color = ITEM_COLORS[track.item.type];
  const width = 32;
  const height = 14;

  ctx.save();
  ctx.translate(screen.x, screen.y - 8);
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.ellipse(0, 8, 12, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(80, 68, 56, 0.12)";
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 6);
  ctx.fillStyle = "#fffaf3";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-width / 2 + 3, -height / 2 + 3, 8, height - 6, 3);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = "#5d554d";
  ctx.font = "700 7px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, 5, 2.5);

  ctx.restore();
}

function getTransitLabel(type: WorkItem["type"]): string {
  if (type === "issue") {
    return "SPEC";
  }
  if (type === "deployment") {
    return "SHIP";
  }
  return "PR";
}
