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

function classifyCopilotToken(token) {
  if (!token) {
    return { present: false, detail: "Missing COPILOT_GITHUB_TOKEN." };
  }
  if (token.startsWith("github_pat_")) {
    return { present: true, detail: "Fine-grained GitHub PAT detected." };
  }
  if (token.startsWith("ghp_")) {
    return {
      present: false,
      detail: "Classic PAT detected. gh-aw rejects classic PATs for GitHub Copilot; use a github_pat_ token.",
    };
  }
  if (token.startsWith("gho_")) {
    return {
      present: false,
      detail: "OAuth token detected. Use a fine-grained github_pat_ token for GitHub Copilot.",
    };
  }
  return {
    present: false,
    detail: "Unrecognized Copilot token format. Use a fine-grained github_pat_ token.",
  };
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

  return !["gh-aw-github-token", "pipeline-app-id", "pipeline-app-private-key"].includes(id);
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
  const copilotToken = classifyCopilotToken(
    env.COPILOT_GITHUB_TOKEN || env.PUBLIC_BETA_COPILOT_GITHUB_TOKEN || ""
  );
  const workflowToken = classifyWorkflowToken(env.GH_AW_GITHUB_TOKEN || "");

  return [
    makeCheck(
      mode,
      true,
      "openrouter",
      "OpenRouter API",
      Boolean(env.OPENROUTER_API_KEY),
      env.OPENROUTER_API_KEY ? "OPENROUTER_API_KEY is configured." : "Missing OPENROUTER_API_KEY."
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
    makeCheck(mode, true, "copilot-token", "Copilot token", copilotToken.present, copilotToken.detail),
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
  classifyCopilotToken,
  classifyWorkflowToken,
  runPreflight,
};
