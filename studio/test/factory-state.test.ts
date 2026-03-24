import { createInitialState, factoryReducer } from "@/components/factory/factory-state";

describe("factory ambient state", () => {
  it("keeps ambient busy for intermediate celebrate beats while work is still active", () => {
    let state = createInitialState();
    state = factoryReducer(state, {
      type: "AGENT_START_WORK",
      agent: "developer",
      task: "Building",
    });

    state = factoryReducer(state, {
      type: "AGENT_CELEBRATE",
      agent: "planner",
    });

    expect(state.ambient).toBe("busy");
  });

  it("still allows the explicit terminal celebration ambient", () => {
    let state = createInitialState();
    state = factoryReducer(state, {
      type: "AGENT_CELEBRATE",
      agent: "deployer",
    });

    expect(state.ambient).toBe("quiet");

    state = factoryReducer(state, {
      type: "AMBIENT_CHANGE",
      ambient: "celebrating",
    });

    expect(state.ambient).toBe("celebrating");
  });
});
