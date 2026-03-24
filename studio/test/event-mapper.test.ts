import { mapBuildEvent } from "@/components/factory/event-mapper";
import type { BuildEvent } from "@/lib/types";

function makeEvent(
  partial: Partial<BuildEvent> & Pick<BuildEvent, "id" | "category" | "kind">
): BuildEvent {
  return {
    build_session_id: "session-1",
    created_at: "2026-03-23T20:00:00.000Z",
    data: {},
    ...partial,
  };
}

describe("factory event mapper", () => {
  it("starts the build by moving a work brief onto the coding floor", () => {
    const actions = mapBuildEvent(
      makeEvent({
        id: 11,
        category: "build",
        kind: "pipeline_started",
        data: { detail: "Building" },
      })
    );

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "AGENT_START_WORK",
          agent: "developer",
        }),
        expect.objectContaining({
          type: "ITEM_TRANSIT",
          from: "blueprint-table",
          to: "code-forge",
          item: expect.objectContaining({
            type: "issue",
            label: "Work brief",
          }),
        }),
      ])
    );
  });

  it("moves approved work into the launch pad before deploy", () => {
    const actions = mapBuildEvent(
      makeEvent({
        id: 12,
        category: "build",
        kind: "ci_passed",
      })
    );

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ITEM_TRANSIT",
          from: "inspection-bay",
          to: "launch-pad",
          item: expect.objectContaining({
            type: "deployment",
            label: "Preview deploy",
          }),
        }),
        expect.objectContaining({
          type: "AGENT_START_WORK",
          agent: "deployer",
          task: "Deploying",
        }),
      ])
    );
  });
});
