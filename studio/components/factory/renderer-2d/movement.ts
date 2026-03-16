import type { AgentId } from "../factory-types";

interface Position {
  x: number;
  y: number;
}

interface AgentMovement {
  current: Position;
  home: Position;
  target: Position | null;
  speed: number; // world units per second
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dist(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class MovementSystem {
  private agents: Map<AgentId, AgentMovement> = new Map();
  private reducedMotion = false;

  constructor() {
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  setHome(agentId: AgentId, x: number, y: number) {
    const existing = this.agents.get(agentId);
    if (existing) {
      existing.home = { x, y };
      if (!existing.target) {
        existing.current = { x, y };
      }
    } else {
      this.agents.set(agentId, {
        current: { x, y },
        home: { x, y },
        target: null,
        speed: 3, // world units per second
      });
    }
  }

  moveTo(agentId: AgentId, x: number, y: number) {
    if (this.reducedMotion) return;
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.target = { x, y };
    }
  }

  returnHome(agentId: AgentId) {
    if (this.reducedMotion) return;
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.target = { ...agent.home };
    }
  }

  update(deltaTime: number) {
    if (this.reducedMotion) return;

    for (const agent of this.agents.values()) {
      if (!agent.target) continue;

      const d = dist(agent.current, agent.target);
      if (d < 0.05) {
        agent.current = { ...agent.target };
        agent.target = null;
        continue;
      }

      const step = agent.speed * deltaTime;
      const t = Math.min(1, step / d);
      const eased = easeInOut(t);

      agent.current = {
        x: lerp(agent.current.x, agent.target.x, eased),
        y: lerp(agent.current.y, agent.target.y, eased),
      };
    }
  }

  getPosition(agentId: AgentId): Position {
    const agent = this.agents.get(agentId);
    return agent ? { ...agent.current } : { x: 0, y: 0 };
  }

  isWalking(agentId: AgentId): boolean {
    if (this.reducedMotion) return false;
    const agent = this.agents.get(agentId);
    return agent?.target !== null && agent?.target !== undefined;
  }
}
