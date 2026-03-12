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

function runPreflight(projectRoot) {
  return [
    {
      id: "openrouter",
      name: "OpenRouter API",
      required: true,
      present: Boolean(process.env.OPENROUTER_API_KEY),
    },
    {
      id: "gh",
      name: "GitHub CLI",
      required: true,
      present: commandExists("gh"),
    },
    {
      id: "gh-auth",
      name: "GitHub auth",
      required: true,
      present: ghAuthOk(),
    },
    {
      id: "gh-aw",
      name: "gh-aw",
      required: true,
      present: commandExists("gh", ["aw", "version"]),
    },
    {
      id: "copilot-token",
      name: "Copilot token",
      required: true,
      present: Boolean(process.env.COPILOT_GITHUB_TOKEN),
    },
    {
      id: "vercel-token",
      name: "Vercel token",
      required: false,
      present: Boolean(process.env.VERCEL_TOKEN),
    },
    {
      id: "workiq",
      name: "WorkIQ client",
      required: false,
      present: fs.existsSync(path.join(projectRoot, "extraction", "workiq-client.ts")),
    },
  ];
}

module.exports = {
  runPreflight,
};
