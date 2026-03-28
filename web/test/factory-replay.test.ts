import {
  getFactoryReplayDelay,
  getFactoryReplayLeadIn,
  getFactoryReplaySeed,
  isFactoryPlaybackEvent,
} from "@/components/factory/factory-replay";
import type { BuildEvent } from "@/lib/types";

function makeEvent(partial: Partial<BuildEvent> & Pick<BuildEvent, "id" | "category" | "kind">): BuildEvent {
  return {
    build_session_id: "session-1",
    data: {},
    created_at: "2026-03-23T20:00:00.000Z",
    ...partial,
  };
}

describe("factory replay profile", () => {
  it("filters chat events out of playback", () => {
    expect(
      isFactoryPlaybackEvent(
        makeEvent({ id: 1, category: "chat", kind: "assistant_message" })
      )
    ).toBe(false);
    expect(
      isFactoryPlaybackEvent(
        makeEvent({ id: 2, category: "build", kind: "pr_opened" })
      )
    ).toBe(true);
  });

  it("uses a fixed lead-in for demo playback", () => {
    expect(getFactoryReplayLeadIn("demo")).toBe(900);
  });

  it("uses a slower seeded profile for recording playback", () => {
    expect(getFactoryReplayLeadIn("recording")).toBeGreaterThan(
      getFactoryReplayLeadIn("demo")
    );
    expect(getFactoryReplaySeed("recording")).toBe(20260324);
    expect(getFactoryReplaySeed("demo")).toBeNull();
  });

  it("holds longer on review and completion beats than generic events", () => {
    expect(
      getFactoryReplayDelay(makeEvent({ id: 3, category: "build", kind: "pr_opened" }), "demo")
    ).toBeGreaterThan(
      getFactoryReplayDelay(makeEvent({ id: 4, category: "build", kind: "repo_created" }), "demo")
    );
    expect(
      getFactoryReplayDelay(makeEvent({ id: 5, category: "delivery", kind: "complete" }), "demo")
    ).toBeGreaterThan(
      getFactoryReplayDelay(makeEvent({ id: 6, category: "build", kind: "agent_progress" }), "demo")
    );
    expect(
      getFactoryReplayDelay(
        makeEvent({ id: 7, category: "delivery", kind: "complete" }),
        "recording"
      )
    ).toBeGreaterThan(
      getFactoryReplayDelay(
        makeEvent({ id: 8, category: "delivery", kind: "complete" }),
        "demo"
      )
    );
  });
});
