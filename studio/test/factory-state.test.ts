import { createInitialState, factoryReducer } from "@/components/factory/factory-state";

describe("factoryReducer", () => {
  it("recomputes ambient after an agent is unblocked", () => {
    let state = createInitialState();

    state = factoryReducer(state, {
      type: "AGENT_BLOCKED",
      agent: "planner",
      reason: "Waiting for installation",
    });
    expect(state.ambient).toBe("blocked");

    state = factoryReducer(state, {
      type: "AGENT_UNBLOCKED",
      agent: "planner",
    });
    expect(state.ambient).toBe("quiet");
  });

  it("switches ambient to celebrating when an agent completes work", () => {
    const state = factoryReducer(createInitialState(), {
      type: "AGENT_CELEBRATE",
      agent: "reviewer",
    });

    expect(state.ambient).toBe("celebrating");
  });
});
