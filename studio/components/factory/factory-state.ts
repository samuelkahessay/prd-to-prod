import type {
  AgentCharacter,
  AgentId,
  AmbientState,
  FactoryAction,
  FactoryState,
  Workstation,
  WorkstationId,
} from "./factory-types";
import {
  AGENT_WORKSTATION,
  ALL_AGENTS,
  ALL_WORKSTATIONS,
} from "./factory-types";

export function createInitialState(): FactoryState {
  const agents = {} as Record<AgentId, AgentCharacter>;
  for (const id of ALL_AGENTS) {
    agents[id] = {
      id,
      state: "idle",
      stateStartedAt: 0,
      workstation: AGENT_WORKSTATION[id],
      currentTask: null,
      progress: 0,
    };
  }

  const workstations = {} as Record<WorkstationId, Workstation>;
  for (const id of ALL_WORKSTATIONS) {
    workstations[id] = { id, activeAgent: null, items: [] };
  }

  return {
    agents,
    workstations,
    conveyor: [],
    output: { repoUrl: null, deployUrl: null, prCount: 0, issueCount: 0 },
    ambient: "quiet",
    elapsedMs: 0,
    lastEventAt: 0,
  };
}

export function factoryReducer(
  state: FactoryState,
  action: FactoryAction
): FactoryState {
  switch (action.type) {
    case "AGENT_START_WORK":
      return agentStartWork(state, action.agent, action.task);

    case "AGENT_FINISH_WORK":
      return agentFinishWork(state, action.agent);

    case "AGENT_BLOCKED":
      return updateAgentAndAmbient(state, action.agent, {
        state: "blocked",
        currentTask: action.reason,
      });

    case "AGENT_UNBLOCKED":
      return updateAgentAndAmbient(state, action.agent, {
        state: "idle",
        currentTask: null,
      });

    case "AGENT_CELEBRATE":
      return updateAgentAndAmbient(state, action.agent, {
        state: "celebrating",
        progress: 1,
      });

    case "ITEM_ENTER":
      return itemEnter(state, action.workstation, action.item);

    case "ITEM_TRANSIT":
      return itemTransit(state, action.from, action.to, action.item);

    case "OUTPUT_UPDATE":
      return {
        ...state,
        output: { ...state.output, ...action.fields },
        lastEventAt: Date.now(),
      };

    case "AMBIENT_CHANGE":
      return { ...state, ambient: action.ambient, lastEventAt: Date.now() };

    case "TICK":
      return { ...state, elapsedMs: action.elapsedMs };

    default:
      return state;
  }
}

function agentStartWork(
  state: FactoryState,
  agentId: AgentId,
  task: string
): FactoryState {
  const workstationId = AGENT_WORKSTATION[agentId];
  const updatedState = updateAgent(state, agentId, {
    state: "working",
    currentTask: task,
    progress: 0,
  });

  return {
    ...updatedState,
    workstations: {
      ...updatedState.workstations,
      [workstationId]: {
        ...updatedState.workstations[workstationId],
        activeAgent: agentId,
      },
    },
    ambient: computeAmbient(updatedState),
    lastEventAt: Date.now(),
  };
}

function agentFinishWork(
  state: FactoryState,
  agentId: AgentId
): FactoryState {
  const workstationId = AGENT_WORKSTATION[agentId];
  const updatedState = updateAgent(state, agentId, {
    state: "idle",
    currentTask: null,
    progress: 0,
  });

  return {
    ...updatedState,
    workstations: {
      ...updatedState.workstations,
      [workstationId]: {
        ...updatedState.workstations[workstationId],
        activeAgent: null,
      },
    },
    ambient: computeAmbient(updatedState),
    lastEventAt: Date.now(),
  };
}

function updateAgent(
  state: FactoryState,
  agentId: AgentId,
  fields: Partial<AgentCharacter>
): FactoryState {
  return {
    ...state,
    agents: {
      ...state.agents,
      [agentId]: {
        ...state.agents[agentId],
        ...fields,
        stateStartedAt: Date.now(),
      },
    },
    lastEventAt: Date.now(),
  };
}

function updateAgentAndAmbient(
  state: FactoryState,
  agentId: AgentId,
  fields: Partial<AgentCharacter>
): FactoryState {
  const updatedState = updateAgent(state, agentId, fields);
  return {
    ...updatedState,
    ambient: computeAmbient(updatedState),
    lastEventAt: Date.now(),
  };
}

function itemEnter(
  state: FactoryState,
  workstationId: WorkstationId,
  item: { id: string; type: "issue" | "pr" | "deployment"; label: string; enteredAt: number }
): FactoryState {
  const ws = state.workstations[workstationId];
  return {
    ...state,
    workstations: {
      ...state.workstations,
      [workstationId]: {
        ...ws,
        items: [...ws.items, item],
      },
    },
    lastEventAt: Date.now(),
  };
}

function itemTransit(
  state: FactoryState,
  from: WorkstationId,
  to: WorkstationId,
  item: { id: string; type: "issue" | "pr" | "deployment"; label: string; enteredAt: number }
): FactoryState {
  const fromWs = state.workstations[from];
  const conveyorItem = {
    id: `transit-${item.id}-${Date.now()}`,
    from,
    to,
    item,
    progress: 0,
  };

  return {
    ...state,
    workstations: {
      ...state.workstations,
      [from]: {
        ...fromWs,
        items: fromWs.items.filter((i) => i.id !== item.id),
      },
    },
    conveyor: [...state.conveyor, conveyorItem],
    lastEventAt: Date.now(),
  };
}

function computeAmbient(state: FactoryState): AmbientState {
  const agents = Object.values(state.agents);
  if (agents.some((a) => a.state === "blocked")) return "blocked";
  if (agents.some((a) => a.state === "working")) return "busy";
  return "quiet";
}
