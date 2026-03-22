#!/usr/bin/env node

const path = require("path");

const { createDatabase } = require("../../console/lib/db");
const { createBuildSessionStore } = require("../../console/lib/build-session-store");
const { createServiceResolver } = require("../../console/lib/service-resolver");
const { createE2EHarness } = require("../../console/lib/e2e/harness");
const { resolveCookieJarPath } = require("../../console/lib/e2e/constants");

const projectRoot = path.resolve(__dirname, "..", "..");
const dataDir = process.env.DATA_DIR || path.join(projectRoot, "console", "data");
const db = createDatabase(dataDir);
const buildSessionStore = createBuildSessionStore(db);
const serviceResolver = createServiceResolver({ db, buildSessionStore });
const harness = createE2EHarness({
  db,
  buildSessionStore,
  serviceResolver,
  projectRoot,
  baseUrl:
    process.env.E2E_CONSOLE_URL ||
    process.env.API_URL ||
    `http://127.0.0.1:${process.env.CONSOLE_PORT || 3000}`,
  studioUrl:
    process.env.E2E_STUDIO_URL ||
    process.env.FRONTEND_URL ||
    "http://127.0.0.1:3001",
});

const args = process.argv.slice(2);
const command = args[0];

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });

async function main() {
  switch (command) {
    case "auth-check":
      await authCheck(args.slice(1));
      return;
    case "auth-refresh":
      await authRefresh(args.slice(1));
      return;
    case "run":
      await runLane(args.slice(1));
      return;
    case "watch":
      await watchRun(args.slice(1));
      return;
    case "cleanup":
      await cleanupRun(args.slice(1));
      return;
    case "report":
      await reportRun(args.slice(1));
      return;
    default:
      printUsage();
  }
}

async function authCheck(argv) {
  const pathArg = readOption(argv, "--path") || resolveCookieJarPath(projectRoot);
  const result = await harness.validateAuth(pathArg);
  console.log(`Saved browser auth for ${result.user.githubLogin}.`);
  console.log(`cookieJarPath: ${result.cookieJarPath}`);
}

async function authRefresh(argv) {
  const pathArg = readOption(argv, "--path") || resolveCookieJarPath(projectRoot);
  const openBrowser = !argv.includes("--no-open");
  const url = harness.authBootstrapUrl(pathArg);

  console.log(`Auth export page: ${url}`);
  console.log(`Cookie jar path: ${pathArg}`);

  if (openBrowser) {
    try {
      const { spawnSync } = require("child_process");
      spawnSync("open", [url], { stdio: "ignore" });
      console.log("Opened the browser auth export page.");
    } catch {
      console.log("Open the auth export page manually if the browser did not open.");
    }
  }

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    try {
      const result = await harness.validateAuth(pathArg);
      console.log(`Saved browser auth for ${result.user.githubLogin}.`);
      return;
    } catch {
      await delay(2_000);
    }
  }

  throw new Error("Timed out waiting for the cookie jar export to complete.");
}

async function runLane(argv) {
  const lane = readOption(argv, "--lane");
  if (!lane) {
    throw new Error("--lane is required");
  }

  const keepRepo = argv.includes("--keep-repo");
  const cookieJarPath = readOption(argv, "--path") || resolveCookieJarPath(projectRoot);
  const run = await harness.runNow({
    lane,
    keepRepo,
    cookieJarPath,
    requestedBy: "cli",
  });

  printRun(run);
}

async function watchRun(argv) {
  const runId = argv[0];
  if (!runId) {
    throw new Error("watch requires a run id");
  }

  let lastEventId = 0;
  while (true) {
    const run = harness.getRun(runId);
    if (!run) {
      throw new Error("Run not found");
    }

    const nextEvents = (run.events || []).filter((event) => event.id > lastEventId);
    for (const event of nextEvents) {
      lastEventId = event.id;
      console.log(
        `${event.createdAt} ${event.lane || run.lane} ${event.step} ${event.status}${event.detail ? ` ${event.detail}` : ""}`
      );
    }

    if (["passed", "failed", "auth_required", "cleaned_up", "cancelled"].includes(run.status)) {
      printRun(run);
      return;
    }

    await delay(2_000);
  }
}

async function cleanupRun(argv) {
  const runId = argv[0];
  if (!runId) {
    throw new Error("cleanup requires a run id");
  }

  const force = argv.includes("--force");
  const run = await harness.cleanupRun(runId, { force });
  printRun(run);
}

async function reportRun(argv) {
  const runId = argv[0];
  if (!runId) {
    throw new Error("report requires a run id");
  }

  const run = harness.getRun(runId);
  if (!run) {
    throw new Error("Run not found");
  }

  console.log(`run: ${run.id}`);
  console.log(`status: ${run.status}`);
  console.log(`reportJsonPath: ${run.reportJsonPath || "n/a"}`);
  console.log(`reportMarkdownPath: ${run.reportMarkdownPath || "n/a"}`);
}

function printRun(run) {
  console.log(`runId: ${run.id}`);
  console.log(`lane: ${run.lane}`);
  console.log(`status: ${run.status}`);
  console.log(`failureClass: ${run.failureClass || "none"}`);
  console.log(`failureDetail: ${run.failureDetail || "n/a"}`);
  console.log(`buildSessionId: ${run.buildSessionId || "n/a"}`);
  console.log(`repo: ${run.repoFullName || "n/a"}`);
  console.log(`rootIssue: ${run.rootIssueNumber || "n/a"}`);
  console.log(`firstPr: ${run.firstPrNumber || "n/a"}`);
  console.log(`cleanup: ${run.cleanupStatus}${run.cleanupDetail ? ` (${run.cleanupDetail})` : ""}`);
  console.log(`reportJsonPath: ${run.reportJsonPath || "n/a"}`);
  console.log(`reportMarkdownPath: ${run.reportMarkdownPath || "n/a"}`);
}

function readOption(argv, key) {
  const index = argv.indexOf(key);
  if (index === -1) {
    return "";
  }
  return argv[index + 1] || "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage() {
  console.log("Usage:");
  console.log("  scripts/e2e/harness.sh auth-check [--path <cookie-jar>]");
  console.log("  scripts/e2e/harness.sh auth-refresh [--path <cookie-jar>] [--no-open]");
  console.log("  scripts/e2e/harness.sh run --lane <lane> [--keep-repo] [--path <cookie-jar>]");
  console.log("  scripts/e2e/harness.sh watch <run-id>");
  console.log("  scripts/e2e/harness.sh cleanup <run-id> [--force]");
  console.log("  scripts/e2e/harness.sh report <run-id>");
}
