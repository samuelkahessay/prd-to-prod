import type { AgentId, CharacterState } from "../factory-types";

export type BehaviorType =
  | "sip_coffee"
  | "look_around"
  | "stretch"
  | "check_phone"
  | "scratch_head"
  | "lean_back"
  | "walk_briefly"
  // Character-specific overrides
  | "check_whiteboard"
  | "adjust_headphones"
  | "examine_swatches"
  | "review_notes"
  | "check_monitors";

interface BehaviorDef {
  type: BehaviorType;
  weight: number;
  duration: number; // seconds
}

const DEFAULT_BEHAVIORS: BehaviorDef[] = [
  { type: "sip_coffee", weight: 20, duration: 2 },
  { type: "look_around", weight: 25, duration: 3 },
  { type: "stretch", weight: 15, duration: 2.5 },
  { type: "check_phone", weight: 10, duration: 3 },
  { type: "scratch_head", weight: 10, duration: 1.5 },
  { type: "lean_back", weight: 10, duration: 4 },
  { type: "walk_briefly", weight: 10, duration: 6 },
];

const AGENT_OVERRIDES: Partial<
  Record<AgentId, { replace: BehaviorType; with: BehaviorDef }>
> = {
  planner: {
    replace: "check_phone",
    with: { type: "check_whiteboard", weight: 10, duration: 3 },
  },
  developer: {
    replace: "scratch_head",
    with: { type: "adjust_headphones", weight: 10, duration: 1.5 },
  },
  "frontend-designer": {
    replace: "look_around",
    with: { type: "examine_swatches", weight: 25, duration: 3 },
  },
  reviewer: {
    replace: "lean_back",
    with: { type: "review_notes", weight: 10, duration: 4 },
  },
  deployer: {
    replace: "look_around",
    with: { type: "check_monitors", weight: 25, duration: 3 },
  },
};

export interface IdleState {
  behavior: BehaviorType;
  progress: number; // 0-1
}

interface AgentIdleState {
  idleTimer: number;
  currentBehavior: { type: BehaviorType; startTime: number; duration: number } | null;
  cooldown: number;
}

interface IdleBehaviorManagerOptions {
  random?: () => number;
  reducedMotion?: boolean;
}

function getBehaviorsForAgent(agentId: AgentId): BehaviorDef[] {
  const override = AGENT_OVERRIDES[agentId];
  if (!override) return DEFAULT_BEHAVIORS;

  return DEFAULT_BEHAVIORS.map((b) =>
    b.type === override.replace ? override.with : b
  );
}

function pickWeightedRandom(
  behaviors: BehaviorDef[],
  random: () => number
): BehaviorDef {
  const totalWeight = behaviors.reduce((sum, b) => sum + b.weight, 0);
  let r = random() * totalWeight;
  for (const b of behaviors) {
    r -= b.weight;
    if (r <= 0) return b;
  }
  return behaviors[0];
}

export class IdleBehaviorManager {
  private states: Map<AgentId, AgentIdleState> = new Map();
  private reducedMotion = false;
  private readonly random: () => number;

  constructor(options: IdleBehaviorManagerOptions = {}) {
    this.random = options.random ?? Math.random;
    this.reducedMotion =
      options.reducedMotion ??
      (typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  update(agentId: AgentId, agentState: CharacterState, deltaTime: number) {
    if (this.reducedMotion) return;
    if (agentState !== "idle") {
      // Reset idle timer when not idle
      this.states.set(agentId, {
        idleTimer: 0,
        currentBehavior: null,
        cooldown: 2,
      });
      return;
    }

    let s = this.states.get(agentId);
    if (!s) {
      s = { idleTimer: 0, currentBehavior: null, cooldown: 2 };
      this.states.set(agentId, s);
    }

    s.idleTimer += deltaTime;

    // Check if current behavior is done
    if (s.currentBehavior) {
      const elapsed = s.idleTimer - s.currentBehavior.startTime;
      if (elapsed >= s.currentBehavior.duration) {
        s.currentBehavior = null;
        s.cooldown = 3 + this.random() * 4; // 3-7s between behaviors
      }
      return;
    }

    // Check cooldown
    s.cooldown -= deltaTime;
    if (s.cooldown > 0) return;

    // Must be idle for at least 5 seconds
    if (s.idleTimer < 5) return;

    // Pick a new behavior
    const behaviors = getBehaviorsForAgent(agentId);
    const picked = pickWeightedRandom(behaviors, this.random);
    s.currentBehavior = {
      type: picked.type,
      startTime: s.idleTimer,
      duration: picked.duration,
    };
  }

  getIdleState(agentId: AgentId): IdleState | null {
    if (this.reducedMotion) return null;
    const s = this.states.get(agentId);
    if (!s?.currentBehavior) return null;

    const elapsed = s.idleTimer - s.currentBehavior.startTime;
    const progress = Math.min(1, elapsed / s.currentBehavior.duration);

    return {
      behavior: s.currentBehavior.type,
      progress,
    };
  }
}
