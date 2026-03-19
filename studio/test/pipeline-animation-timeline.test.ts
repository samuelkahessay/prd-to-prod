import { PIPELINE_ACTS, PIPELINE_LOOP_SECONDS } from "@/components/landing/pipeline-animation";

describe("Pipeline animation timeline", () => {
  it("gives the heal act enough time to finish fading before the loop resets", () => {
    const healAct = PIPELINE_ACTS[4];

    expect(PIPELINE_LOOP_SECONDS).toBe(10);
    expect(healAct.end).toBe(PIPELINE_LOOP_SECONDS);
    expect(healAct.end - healAct.start).toBeGreaterThanOrEqual(2.25);
  });
});
