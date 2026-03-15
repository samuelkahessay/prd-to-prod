export type AgentId =
  | "planner"
  | "developer"
  | "frontend-designer"
  | "reviewer"
  | "deployer";

export type CharacterState =
  | "idle"
  | "working"
  | "reviewing"
  | "celebrating"
  | "blocked";

export type WorkstationId =
  | "blueprint-table"
  | "code-forge"
  | "design-studio"
  | "inspection-bay"
  | "launch-pad";

export interface AgentCharacter {
  id: AgentId;
  state: CharacterState;
  stateStartedAt: number;
  workstation: WorkstationId;
  currentTask: string | null;
  progress: number; // 0-1
}

export interface WorkItem {
  id: string;
  type: "issue" | "pr" | "deployment";
  label: string;
  enteredAt: number;
}

export interface Workstation {
  id: WorkstationId;
  activeAgent: AgentId | null;
  items: WorkItem[];
}

export interface ConveyorItem {
  id: string;
  from: WorkstationId;
  to: WorkstationId;
  item: WorkItem;
  progress: number; // 0-1 along the belt
}

export type AmbientState = "quiet" | "busy" | "blocked" | "celebrating";

export interface OutputDisplay {
  repoUrl: string | null;
  deployUrl: string | null;
  prCount: number;
  issueCount: number;
}

export interface FactoryState {
  agents: Record<AgentId, AgentCharacter>;
  workstations: Record<WorkstationId, Workstation>;
  conveyor: ConveyorItem[];
  output: OutputDisplay;
  ambient: AmbientState;
  elapsedMs: number;
  lastEventAt: number;
}

// Actions dispatched from the event mapper
export type FactoryAction =
  | { type: "AGENT_START_WORK"; agent: AgentId; task: string }
  | { type: "AGENT_FINISH_WORK"; agent: AgentId }
  | { type: "AGENT_BLOCKED"; agent: AgentId; reason: string }
  | { type: "AGENT_UNBLOCKED"; agent: AgentId }
  | { type: "AGENT_CELEBRATE"; agent: AgentId }
  | { type: "ITEM_ENTER"; workstation: WorkstationId; item: WorkItem }
  | {
      type: "ITEM_TRANSIT";
      from: WorkstationId;
      to: WorkstationId;
      item: WorkItem;
    }
  | { type: "OUTPUT_UPDATE"; fields: Partial<OutputDisplay> }
  | { type: "AMBIENT_CHANGE"; ambient: AmbientState }
  | { type: "TICK"; elapsedMs: number };

export const AGENT_WORKSTATION: Record<AgentId, WorkstationId> = {
  planner: "blueprint-table",
  developer: "code-forge",
  "frontend-designer": "design-studio",
  reviewer: "inspection-bay",
  deployer: "launch-pad",
};

export const ALL_AGENTS: AgentId[] = [
  "planner",
  "developer",
  "frontend-designer",
  "reviewer",
  "deployer",
];

export const ALL_WORKSTATIONS: WorkstationId[] = [
  "blueprint-table",
  "code-forge",
  "design-studio",
  "inspection-bay",
  "launch-pad",
];
