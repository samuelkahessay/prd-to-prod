const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function commandExists(command, args = ["--version"]) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch (_error) {
    return false;
  }
}

function ghAuthOk() {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
    return true;
  } catch (_error) {
    return false;
  }
}

function requiredCheck(id, name, present, detail) {
  return { id, name, required: true, present, detail };
}

function optionalCheck(id, name, present, detail) {
  return { id, name, required: false, present, detail };
}

function classifyAgentApiKey(token) {
  if (!token) {
    return { present: false, detail: "Missing OPENAI_API_KEY." };
  }
  return { present: true, detail: "Agent API key detected." };
}

function classifyCopilotToken(token) {
  if (!token) {
    return { present: false, detail: "Missing COPILOT_GITHUB_TOKEN." };
  }
  return { present: true, detail: "Copilot engine token detected." };
}

function classifyWorkflowToken(token) {
  if (!token) {
    return { present: false, detail: "Missing GH_AW_GITHUB_TOKEN." };
  }
  if (token.startsWith("github_pat_")) {
    return { present: true, detail: "Fine-grained workflow token detected." };
  }
  if (token.startsWith("ghp_")) {
    return { present: true, detail: "Classic workflow PAT detected." };
  }
  return {
    present: false,
    detail: "Unrecognized workflow token format. Use a ghp_ or github_pat_ token.",
  };
}

function requiredInMode(mode, id) {
  if (mode !== "remote-harness") {
    return true;
  }

  return !["copilot", "gh-aw-github-token", "pipeline-app-id", "pipeline-app-private-key"].includes(id);
}

function makeCheck(mode, required, id, name, present, detail) {
  if (!requiredInMode(mode, id)) {
    const remoteDetail = present
      ? `${detail} Remote harness mode will also verify the deployed runtime.`
      : `${detail} Remote harness mode validates this against the deployed runtime instead of the local shell.`;
    return optionalCheck(id, name, present, remoteDetail);
  }

  return required ? requiredCheck(id, name, present, detail) : optionalCheck(id, name, present, detail);
}

function runPreflight(projectRoot, env = process.env, options = {}) {
  const mode = options.mode || "local";
  const ghPresent = commandExists("gh");
  const ghAuthPresent = ghAuthOk();
  const ghAwPresent = commandExists("gh", ["aw", "version"]);
  const deployProfilePresent = fs.existsSync(path.join(projectRoot, ".deploy-profile"));
  const workIqPresent = fs.existsSync(path.join(projectRoot, "extraction", "workiq-client.ts"));
  const copilotToken = classifyCopilotToken(env.COPILOT_GITHUB_TOKEN || env.PUBLIC_BETA_COPILOT_GITHUB_TOKEN || "");
  const agentApiKey = classifyAgentApiKey(
    env.E2E_OPENAI_API_KEY ||
      env.OPENAI_API_KEY ||
      env.PUBLIC_BETA_OPENAI_API_KEY ||
      env.OPENROUTER_API_KEY ||
      env.PUBLIC_BETA_OPENROUTER_API_KEY ||
      ""
  );
  const workflowToken = classifyWorkflowToken(env.GH_AW_GITHUB_TOKEN || "");

  return [
    makeCheck(
      mode,
      true,
      "copilot",
      "Copilot engine token",
      copilotToken.present,
      copilotToken.detail
    ),
    makeCheck(
      mode,
      false,
      "openrouter",
      "Legacy OpenRouter API",
      Boolean(env.OPENROUTER_API_KEY || env.OPENAI_API_KEY),
      env.OPENROUTER_API_KEY || env.OPENAI_API_KEY
        ? "OpenRouter-compatible API key is configured for legacy extraction paths."
        : "OPENROUTER_API_KEY or OPENAI_API_KEY is not configured."
    ),
    makeCheck(
      mode,
      true,
      "gh",
      "GitHub CLI",
      ghPresent,
      ghPresent ? "gh is installed." : "gh is not installed or not on PATH."
    ),
    makeCheck(
      mode,
      true,
      "gh-auth",
      "GitHub auth",
      ghAuthPresent,
      ghAuthPresent ? "gh auth status succeeded." : "gh auth status failed."
    ),
    makeCheck(
      mode,
      true,
      "gh-aw",
      "gh-aw",
      ghAwPresent,
      ghAwPresent ? "gh aw version succeeded." : "gh-aw is not installed or not available to gh."
    ),
    makeCheck(mode, false, "agent-api-key", "Legacy agent API key", agentApiKey.present, agentApiKey.detail),
    makeCheck(
      mode,
      true,
      "gh-aw-github-token",
      "Workflow dispatch token",
      workflowToken.present,
      workflowToken.detail
    ),
    makeCheck(
      mode,
      true,
      "pipeline-app-id",
      "Pipeline app id",
      Boolean(env.PIPELINE_APP_ID),
      env.PIPELINE_APP_ID ? "PIPELINE_APP_ID is configured." : "Missing PIPELINE_APP_ID."
    ),
    makeCheck(
      mode,
      true,
      "pipeline-app-private-key",
      "Pipeline app private key",
      Boolean(env.PIPELINE_APP_PRIVATE_KEY),
      env.PIPELINE_APP_PRIVATE_KEY
        ? "PIPELINE_APP_PRIVATE_KEY is configured."
        : "Missing PIPELINE_APP_PRIVATE_KEY."
    ),
    makeCheck(
      mode,
      true,
      "deploy-profile",
      "Deploy profile",
      deployProfilePresent,
      deployProfilePresent ? ".deploy-profile is present." : "Missing .deploy-profile."
    ),
    makeCheck(
      mode,
      false,
      "vercel-token",
      "Vercel token",
      Boolean(env.VERCEL_TOKEN),
      env.VERCEL_TOKEN ? "VERCEL_TOKEN is configured." : "VERCEL_TOKEN is not configured."
    ),
    makeCheck(
      mode,
      false,
      "workiq",
      "WorkIQ client",
      workIqPresent,
      workIqPresent ? "WorkIQ client exists." : "WorkIQ client is not present in this checkout."
    ),
  ];
}

module.exports = {
  classifyAgentApiKey,
  classifyCopilotToken,
  classifyWorkflowToken,
  runPreflight,
};
