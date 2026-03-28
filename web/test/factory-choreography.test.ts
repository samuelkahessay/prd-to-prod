import {
  CENTER_STAGE,
  getAgentHomePosition,
  getCelebrationRoute,
  getPlannerKickoffRoute,
  getReviewRoutes,
  getSpeechBubbleText,
  getTransitPath,
  sampleRoutePoint,
} from "@/components/factory/renderer-2d/choreography";

describe("factory choreography helpers", () => {
  it("builds review handoff routes that bring both agents back to their stations", () => {
    const routes = getReviewRoutes("code-forge");

    expect(routes).not.toBeNull();
    expect(routes?.sourceAgent).toBe("developer");
    expect(routes?.sourceRoute.at(-1)).toEqual(getAgentHomePosition("developer"));
    expect(routes?.reviewerRoute.at(-1)).toEqual(getAgentHomePosition("reviewer"));
  });

  it("stages the final convergence instead of jumping straight to center", () => {
    const route = getCelebrationRoute("deployer");

    expect(route).toHaveLength(2);
    expect(route[0]).not.toEqual(CENTER_STAGE);
    expect(route[1]).toEqual(CENTER_STAGE);
  });

  it("samples transit paths from their endpoints", () => {
    const path = getTransitPath("inspection-bay", "launch-pad");

    expect(sampleRoutePoint(path, 0)).toEqual(path[0]);
    expect(sampleRoutePoint(path, 1)).toEqual(path[path.length - 1]);
    expect(path.length).toBeGreaterThan(2);
  });

  it("maps task details to tighter speech bubble copy", () => {
    expect(
      getSpeechBubbleText("developer", "working", "Fixing CI failure", 0)
    ).toBe("Fixing checks");
    expect(
      getSpeechBubbleText("reviewer", "working", "Reviewing pull request", 1)
    ).toBe("Checking edges");
    expect(
      getSpeechBubbleText(
        "planner",
        "blocked",
        "Waiting for GitHub App installation",
        0
      )
    ).toBe("Need access");
    expect(getPlannerKickoffRoute("Bootstrapping repo")).not.toBeNull();
  });
});
