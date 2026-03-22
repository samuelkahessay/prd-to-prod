const { execFileSync } = require("child_process");
const fs = require("fs");

jest.mock("child_process", () => ({
  execFileSync: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

const {
  classifyCopilotToken,
  classifyWorkflowToken,
  runPreflight,
} = require("../lib/preflight");

describe("preflight", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockImplementation((targetPath) => targetPath.endsWith(".deploy-profile"));
    execFileSync.mockImplementation((command, args) => {
      if (command === "gh" && JSON.stringify(args) === JSON.stringify(["auth", "status"])) {
        return Buffer.from("");
      }
      if (
        command === "gh" &&
        (JSON.stringify(args) === JSON.stringify(["--version"]) ||
          JSON.stringify(args) === JSON.stringify(["aw", "version"]))
      ) {
        return Buffer.from("");
      }
      throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
    });
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.COPILOT_GITHUB_TOKEN;
    delete process.env.PUBLIC_BETA_COPILOT_GITHUB_TOKEN;
    delete process.env.GH_AW_GITHUB_TOKEN;
    delete process.env.PIPELINE_APP_ID;
    delete process.env.PIPELINE_APP_PRIVATE_KEY;
    delete process.env.VERCEL_TOKEN;
  });

  test("accepts a fine-grained Copilot PAT and workflow PAT", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";
    process.env.GH_AW_GITHUB_TOKEN = "ghp_workflow";
    process.env.PIPELINE_APP_ID = "123";
    process.env.PIPELINE_APP_PRIVATE_KEY = "private-key";

    const checks = runPreflight("/repo");
    const requiredFailures = checks.filter((check) => check.required && !check.present);

    expect(requiredFailures).toHaveLength(0);
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "copilot-token",
          present: true,
          detail: expect.stringContaining("Fine-grained"),
        }),
        expect.objectContaining({
          id: "gh-aw-github-token",
          present: true,
          detail: expect.stringContaining("workflow"),
        }),
      ])
    );
  });

  test("rejects classic Copilot PATs before E2E", () => {
    expect(classifyCopilotToken("ghp_classic")).toEqual(
      expect.objectContaining({
        present: false,
        detail: expect.stringContaining("Classic PAT"),
      })
    );
  });

  test("rejects unrecognized workflow tokens", () => {
    expect(classifyWorkflowToken("token-123")).toEqual(
      expect.objectContaining({
        present: false,
        detail: expect.stringContaining("Unrecognized"),
      })
    );
  });

  test("marks missing pipeline credentials as required failures", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";

    const checks = runPreflight("/repo");

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gh-aw-github-token",
          required: true,
          present: false,
        }),
        expect.objectContaining({
          id: "pipeline-app-id",
          required: true,
          present: false,
        }),
        expect.objectContaining({
          id: "pipeline-app-private-key",
          required: true,
          present: false,
        }),
      ])
    );
  });

  test("treats platform secrets as remote-validated in remote harness mode", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";

    const checks = runPreflight("/repo", process.env, { mode: "remote-harness" });
    const requiredFailures = checks.filter((check) => check.required && !check.present);

    expect(requiredFailures).toEqual([]);
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gh-aw-github-token",
          required: false,
          present: false,
          detail: expect.stringContaining("deployed runtime"),
        }),
        expect.objectContaining({
          id: "pipeline-app-id",
          required: false,
          present: false,
          detail: expect.stringContaining("deployed runtime"),
        }),
        expect.objectContaining({
          id: "pipeline-app-private-key",
          required: false,
          present: false,
          detail: expect.stringContaining("deployed runtime"),
        }),
      ])
    );
  });
});
