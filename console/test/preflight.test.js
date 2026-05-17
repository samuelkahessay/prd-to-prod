const { execFileSync } = require("child_process");
const fs = require("fs");

jest.mock("child_process", () => ({
  execFileSync: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

const {
  classifyAgentApiKey,
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
    delete process.env.E2E_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.PUBLIC_BETA_OPENAI_API_KEY;
    delete process.env.GH_AW_GITHUB_TOKEN;
    delete process.env.PIPELINE_APP_ID;
    delete process.env.PIPELINE_APP_PRIVATE_KEY;
    delete process.env.VERCEL_TOKEN;
  });

  test("accepts a Copilot engine token, legacy agent API key, and workflow PAT", () => {
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENAI_API_KEY = "sk-or-v1-key";
    process.env.GH_AW_GITHUB_TOKEN = "ghp_workflow";
    process.env.PIPELINE_APP_ID = "123";
    process.env.PIPELINE_APP_PRIVATE_KEY = "private-key";

    const checks = runPreflight("/repo");
    const requiredFailures = checks.filter((check) => check.required && !check.present);

    expect(requiredFailures).toHaveLength(0);
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "copilot",
          present: true,
          detail: expect.stringContaining("Copilot"),
        }),
        expect.objectContaining({
          id: "agent-api-key",
          present: true,
          detail: expect.stringContaining("Agent API key"),
        }),
        expect.objectContaining({
          id: "gh-aw-github-token",
          present: true,
          detail: expect.stringContaining("workflow"),
        }),
      ])
    );
  });

  test("accepts E2E_OPENAI_API_KEY for harness-driven runs", () => {
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.E2E_OPENAI_API_KEY = "sk-or-v1-key";
    process.env.GH_AW_GITHUB_TOKEN = "ghp_workflow";
    process.env.PIPELINE_APP_ID = "123";
    process.env.PIPELINE_APP_PRIVATE_KEY = "private-key";

    const checks = runPreflight("/repo");
    const agentKeyCheck = checks.find((check) => check.id === "agent-api-key");

    expect(agentKeyCheck).toEqual(
      expect.objectContaining({
        required: false,
        present: true,
        detail: expect.stringContaining("Agent API key"),
      })
    );
  });

  test("rejects missing Copilot token before activation", () => {
    expect(classifyCopilotToken("")).toEqual(
      expect.objectContaining({
        present: false,
        detail: expect.stringContaining("Missing COPILOT_GITHUB_TOKEN"),
      })
    );
  });

  test("treats legacy agent API key as optional support", () => {
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";
    process.env.GH_AW_GITHUB_TOKEN = "ghp_workflow";
    process.env.PIPELINE_APP_ID = "123";
    process.env.PIPELINE_APP_PRIVATE_KEY = "private-key";

    const checks = runPreflight("/repo");
    const agentKeyCheck = checks.find((check) => check.id === "agent-api-key");

    expect(agentKeyCheck).toEqual(
      expect.objectContaining({
        required: false,
        present: false,
        detail: expect.stringContaining("Missing OPENAI_API_KEY"),
      })
    );
  });

  test("accepts legacy agent API key when supplied", () => {
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";
    process.env.E2E_OPENAI_API_KEY = "sk-or-v1-key";
    process.env.GH_AW_GITHUB_TOKEN = "ghp_workflow";
    process.env.PIPELINE_APP_ID = "123";
    process.env.PIPELINE_APP_PRIVATE_KEY = "private-key";

    const checks = runPreflight("/repo");
    const agentKeyCheck = checks.find((check) => check.id === "agent-api-key");

    expect(agentKeyCheck).toEqual(
      expect.objectContaining({
        required: false,
        present: true,
        detail: expect.stringContaining("Agent API key"),
      })
    );
  });

  test("rejects missing agent API keys before E2E", () => {
    expect(classifyAgentApiKey("")).toEqual(
      expect.objectContaining({
        present: false,
        detail: expect.stringContaining("Missing OPENAI_API_KEY"),
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
    process.env.COPILOT_GITHUB_TOKEN = "github_pat_copilot";
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENAI_API_KEY = "sk-or-v1-key";

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
    process.env.OPENAI_API_KEY = "sk-or-v1-key";

    const checks = runPreflight("/repo", process.env, { mode: "remote-harness" });
    const requiredFailures = checks.filter((check) => check.required && !check.present);

    expect(requiredFailures).toEqual([]);
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "copilot",
          required: false,
          present: false,
          detail: expect.stringContaining("deployed runtime"),
        }),
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
