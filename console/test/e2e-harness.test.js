const {
  completeStandardPrdConversation,
  isReadyParsedPrd,
  verifyDecomposerSnapshot,
} = require("../lib/e2e/harness");

test("completeStandardPrdConversation accepts a ready response immediately", async () => {
  const client = {
    sendMessage: jest.fn().mockResolvedValue({
      status: "ready",
      prd: { title: "Bookmark manager" },
    }),
  };

  const parsed = await completeStandardPrdConversation(client, "session-1");

  expect(isReadyParsedPrd(parsed)).toBe(true);
  expect(client.sendMessage).toHaveBeenCalledTimes(1);
});

test("completeStandardPrdConversation nudges until the PRD is ready", async () => {
  const client = {
    sendMessage: jest
      .fn()
      .mockResolvedValueOnce({ status: "needs_input" })
      .mockResolvedValueOnce({
        status: "ready",
        prd: { title: "Bookmark manager" },
      }),
  };

  const parsed = await completeStandardPrdConversation(client, "session-2");

  expect(isReadyParsedPrd(parsed)).toBe(true);
  expect(client.sendMessage).toHaveBeenCalledTimes(2);
  expect(client.sendMessage.mock.calls[1][1]).toContain("Use reasonable assumptions");
});

test("completeStandardPrdConversation stops after the retry budget", async () => {
  const client = {
    sendMessage: jest.fn().mockResolvedValue({ status: "needs_input" }),
  };

  const parsed = await completeStandardPrdConversation(client, "session-3", {
    maxAttempts: 3,
  });

  expect(isReadyParsedPrd(parsed)).toBe(false);
  expect(client.sendMessage).toHaveBeenCalledTimes(3);
});

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
