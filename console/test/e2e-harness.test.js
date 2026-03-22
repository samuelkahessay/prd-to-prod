const { verifyDecomposerSnapshot } = require("../lib/e2e/harness");

test("verifyDecomposerSnapshot ignores agentic workflow failure issues", () => {
  const result = verifyDecomposerSnapshot(
    {
      issues: [
        { number: 1, title: "[Pipeline] Root PRD", labels: ["pipeline"] },
        {
          number: 2,
          title: "[aw] PRD Decomposer failed",
          labels: ["agentic-workflows", "pipeline"],
        },
      ],
    },
    1
  );

  expect(result).toEqual({
    ok: false,
    detail: "No child issues were recorded.",
  });
});

test("verifyDecomposerSnapshot accepts real typed child issues", () => {
  const result = verifyDecomposerSnapshot(
    {
      issues: [
        { number: 1, title: "[Pipeline] Root PRD", labels: ["pipeline"] },
        { number: 2, title: "Add saved search filters", labels: ["pipeline", "feature"] },
      ],
    },
    1
  );

  expect(result).toEqual({ ok: true });
});
