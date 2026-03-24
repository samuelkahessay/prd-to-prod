import { IdleBehaviorManager } from "@/components/factory/renderer-2d/idle-behaviors";
import { createSeededRandom } from "@/components/factory/renderer-2d/random";

describe("seeded factory randomness", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);

    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("keeps idle behavior selection repeatable for recording takes", () => {
    const left = new IdleBehaviorManager({
      random: createSeededRandom(7),
      reducedMotion: false,
    });
    const right = new IdleBehaviorManager({
      random: createSeededRandom(7),
      reducedMotion: false,
    });

    for (let index = 0; index < 16; index += 1) {
      left.update("developer", "idle", 0.5);
      right.update("developer", "idle", 0.5);
    }

    expect(left.getIdleState("developer")).toEqual(
      right.getIdleState("developer")
    );
  });
});
