import type {
  AgentId,
  CharacterState,
  WorkstationId,
} from "../factory-types";
import { AGENT_WORKSTATION } from "../factory-types";
import { WORLD_STATIONS } from "./isometric";

export interface WorldPoint {
  x: number;
  y: number;
}

export const CENTER_STAGE: WorldPoint = { x: 5.5, y: 5 };

const REVIEW_HANDOFF: Record<
  Extract<WorkstationId, "code-forge" | "design-studio">,
  {
    sourceAgent: AgentId;
    sourceRoute: WorldPoint[];
    reviewerRoute: WorldPoint[];
  }
> = {
  "code-forge": {
    sourceAgent: "developer",
    sourceRoute: [
      { x: 6.6, y: 4.2 },
      getAgentHomePosition("developer"),
    ],
    reviewerRoute: [
      { x: 6.5, y: 5.1 },
      getAgentHomePosition("reviewer"),
    ],
  },
  "design-studio": {
    sourceAgent: "frontend-designer",
    sourceRoute: [
      { x: 4.9, y: 5.9 },
      getAgentHomePosition("frontend-designer"),
    ],
    reviewerRoute: [
      { x: 5.8, y: 5.8 },
      getAgentHomePosition("reviewer"),
    ],
  },
};

const CELEBRATION_APPROACH: Record<AgentId, WorldPoint> = {
  planner: { x: 4.5, y: 4.4 },
  developer: { x: 6.5, y: 4.1 },
  "frontend-designer": { x: 4.7, y: 5.9 },
  reviewer: { x: 6.8, y: 5.6 },
  deployer: { x: 8.0, y: 4.8 },
};

const TRANSIT_ANCHORS: Record<WorkstationId, WorldPoint> = {
  "blueprint-table": { x: 3.4, y: 3.1 },
  "code-forge": { x: 8.1, y: 3.0 },
  "design-studio": { x: 3.4, y: 7.1 },
  "inspection-bay": { x: 7.9, y: 6.7 },
  "launch-pad": { x: 10.9, y: 5.4 },
};

const TRANSIT_HUBS: Partial<Record<`${WorkstationId}:${WorkstationId}`, WorldPoint[]>> = {
  "blueprint-table:code-forge": [{ x: 4.9, y: 3.9 }],
  "blueprint-table:design-studio": [{ x: 3.9, y: 4.9 }],
  "code-forge:inspection-bay": [{ x: 7.1, y: 4.2 }, { x: 7.3, y: 5.6 }],
  "design-studio:inspection-bay": [{ x: 4.8, y: 6.1 }, { x: 6, y: 6.2 }],
  "inspection-bay:launch-pad": [{ x: 8.8, y: 5.8 }, { x: 9.7, y: 5.2 }],
};

const EFFECT_ANCHORS: Record<AgentId, WorldPoint> = {
  planner: { x: 3.1, y: 2.9 },
  developer: { x: 7.2, y: 2.4 },
  "frontend-designer": { x: 2.9, y: 6.9 },
  reviewer: { x: 7.6, y: 6.2 },
  deployer: { x: 10.8, y: 5 },
};

export function getAgentHomePosition(agentId: AgentId): WorldPoint {
  const workstation = WORLD_STATIONS[AGENT_WORKSTATION[agentId]];
  return {
    x: workstation.x + 0.8,
    y: workstation.y + 0.5,
  };
}

export function getPlannerKickoffRoute(task: string | null): WorldPoint[] | null {
  const lowered = normalizeTask(task);
  if (!lowered) {
    return null;
  }

  if (lowered.includes("creating") || lowered.includes("bootstrap")) {
    return [
      { x: 4.1, y: 4.2 },
      { x: 3.4, y: 4.7 },
      getAgentHomePosition("planner"),
    ];
  }

  return null;
}

export function getReviewRoutes(
  from: WorkstationId
): {
  sourceAgent: AgentId;
  sourceRoute: WorldPoint[];
  reviewerRoute: WorldPoint[];
} | null {
  if (from !== "code-forge" && from !== "design-studio") {
    return null;
  }

  return REVIEW_HANDOFF[from];
}

export function getDeployerLaunchRoute(): WorldPoint[] {
  return [
    { x: 8.7, y: 4.9 },
    { x: 7.7, y: 4.8 },
    getAgentHomePosition("deployer"),
  ];
}

export function getCelebrationRoute(agentId: AgentId): WorldPoint[] {
  return [CELEBRATION_APPROACH[agentId], CENTER_STAGE];
}

export function getTransitPath(
  from: WorkstationId,
  to: WorkstationId
): WorldPoint[] {
  const key = `${from}:${to}` as const;
  const hubs = TRANSIT_HUBS[key] ?? [];
  return [TRANSIT_ANCHORS[from], ...hubs, TRANSIT_ANCHORS[to]];
}

export function getEffectAnchor(agentId: AgentId): WorldPoint {
  return EFFECT_ANCHORS[agentId];
}

export function sampleRoutePoint(
  route: readonly WorldPoint[],
  progress: number
): WorldPoint {
  if (route.length === 0) {
    return { x: 0, y: 0 };
  }

  if (route.length === 1) {
    return { ...route[0] };
  }

  const segmentLengths: number[] = [];
  let total = 0;

  for (let index = 1; index < route.length; index += 1) {
    const length = distance(route[index - 1], route[index]);
    segmentLengths.push(length);
    total += length;
  }

  if (total === 0) {
    return { ...route[route.length - 1] };
  }

  let remaining = clamp(progress) * total;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segment = segmentLengths[index];
    if (remaining <= segment || index === segmentLengths.length - 1) {
      const start = route[index];
      const end = route[index + 1];
      const localT = segment === 0 ? 1 : remaining / segment;
      return {
        x: lerp(start.x, end.x, localT),
        y: lerp(start.y, end.y, localT),
      };
    }

    remaining -= segment;
  }

  return { ...route[route.length - 1] };
}

export function getSpeechBubbleText(
  agentId: AgentId,
  state: CharacterState,
  currentTask: string | null,
  cycle: number
): string | null {
  if (state === "idle") {
    return null;
  }

  if (state === "blocked") {
    const lowered = normalizeTask(currentTask);
    if (lowered.includes("github app")) {
      return "Need access";
    }
    if (lowered.includes("wait")) {
      return "Awaiting unblock";
    }
    return "Blocked";
  }

  if (state === "celebrating") {
    const options: Record<AgentId, string[]> = {
      planner: ["Plan locked", "Queue clear"],
      developer: ["Patch shipped", "Merged"],
      "frontend-designer": ["UI ready", "Polish landed"],
      reviewer: ["LGTM", "Approved"],
      deployer: ["Live now", "Release cut"],
    };
    return pickFromCycle(options[agentId], cycle);
  }

  const lowered = normalizeTask(currentTask);
  if (agentId === "planner") {
    if (lowered.includes("creating")) {
      return "Spinning repo";
    }
    if (lowered.includes("bootstrap")) {
      return "Laying tracks";
    }
    return pickFromCycle(["Breaking it down", "Scoping work"], cycle);
  }

  if (agentId === "developer") {
    if (lowered.includes("ci")) {
      return "Fixing checks";
    }
    if (lowered.includes("test")) {
      return "Writing tests";
    }
    if (lowered.includes("pr")) {
      return "Opening PR";
    }
    return pickFromCycle(["Building core", "Pushing code"], cycle);
  }

  if (agentId === "frontend-designer") {
    if (lowered.includes("design") || lowered.includes("ui")) {
      return "Polishing UI";
    }
    if (lowered.includes("pr")) {
      return "Packaging UI";
    }
    return pickFromCycle(["Tuning layout", "Refining flow"], cycle);
  }

  if (agentId === "reviewer") {
    if (lowered.includes("review")) {
      return pickFromCycle(["Reading diff", "Checking edges"], cycle);
    }
    return "Reviewing";
  }

  if (lowered.includes("vercel")) {
    return "Waiting on edge";
  }
  if (lowered.includes("deploy")) {
    return "Shipping build";
  }

  return currentTask ? truncateTask(currentTask) : "Stand by";
}

function pickFromCycle(options: string[], cycle: number): string {
  return options[Math.abs(cycle) % options.length];
}

function normalizeTask(task: string | null): string {
  return task?.toLowerCase() ?? "";
}

function truncateTask(task: string): string {
  if (task.length <= 18) {
    return task;
  }

  return `${task.slice(0, 15).trimEnd()}...`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distance(a: WorldPoint, b: WorldPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
