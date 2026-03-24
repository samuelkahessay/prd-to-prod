const path = require("path");

const E2E_LANES = [
  "provision-only",
  "decomposer-only",
  "first-pr",
  "browser-canary",
  "demo-browser-canary",
  "full-ladder",
];

const API_BACKED_LANES = ["provision-only", "decomposer-only", "first-pr"];
const DASHBOARD_LAUNCHABLE_LANES = [
  "provision-only",
  "decomposer-only",
  "first-pr",
  "demo-browser-canary",
  "full-ladder",
];
const FULL_LADDER_SEQUENCE = [
  "provision-only",
  "decomposer-only",
  "first-pr",
  "browser-canary",
];

const E2E_RUN_STATUSES = [
  "queued",
  "auth_required",
  "running",
  "passed",
  "failed",
  "cleaned_up",
  "cancelled",
];

const E2E_FAILURE_CLASSES = [
  "auth_required",
  "ui_auth_failed",
  "ui_flow_failed",
  "provision_failed",
  "bootstrap_conflict",
  "bootstrap_stalled",
  "capacity_waitlisted",
  "decomposer_timeout",
  "provider_retry_exhausted",
  "first_pr_timeout",
  "review_stalled",
  "handoff_stalled",
  "unknown",
];

const LANE_SLAS_MS = {
  "provision-only": {
    repoCreated: 90_000,
    bootstrapReady: 4 * 60_000,
  },
  "decomposer-only": {
    pipelineStarted: 60_000,
    firstChildIssue: 8 * 60_000,
  },
  "first-pr": {
    firstPrOpened: 25 * 60_000,
  },
};

const STANDARD_PRD_TEXT =
  "A personal bookmark manager. Users can save URLs with a title and optional tags, view all bookmarks in a list, search bookmarks by title or tag, and delete bookmarks. Data is stored in localStorage. The UI should have a form to add bookmarks at the top and a searchable list below.";

function resolveCookieJarPath(projectRoot) {
  return path.join(projectRoot, "docs", "internal", ".e2e-cookiejar");
}

function resolveReportDir(projectRoot) {
  return path.join(projectRoot, "output", "e2e");
}

function resolveMarkdownReportDir(projectRoot) {
  return path.join(projectRoot, "docs", "internal", "e2e-runs");
}

module.exports = {
  API_BACKED_LANES,
  DASHBOARD_LAUNCHABLE_LANES,
  E2E_FAILURE_CLASSES,
  E2E_LANES,
  E2E_RUN_STATUSES,
  FULL_LADDER_SEQUENCE,
  LANE_SLAS_MS,
  STANDARD_PRD_TEXT,
  resolveCookieJarPath,
  resolveMarkdownReportDir,
  resolveReportDir,
};
