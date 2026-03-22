const fs = require("fs");
const os = require("os");
const path = require("path");

let tmpDir;
let db;
let createDatabase;
let createBuildSessionStore;
let encrypt;
let createProvisioner;

const ORIGINAL_ENV = {
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  PIPELINE_APP_ID: process.env.PIPELINE_APP_ID,
  PIPELINE_APP_PRIVATE_KEY: process.env.PIPELINE_APP_PRIVATE_KEY,
  GH_AW_GITHUB_TOKEN: process.env.GH_AW_GITHUB_TOKEN,
};

beforeEach(() => {
  jest.resetModules();
  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.PIPELINE_APP_ID = "123456";
  process.env.PIPELINE_APP_PRIVATE_KEY = "test-private-key";
  process.env.GH_AW_GITHUB_TOKEN = "github_pat_test";

  ({ createDatabase } = require("../lib/db"));
  ({ createBuildSessionStore } = require("../lib/build-session-store"));
  ({ encrypt } = require("../lib/crypto"));
  ({ createProvisioner } = require("../lib/provisioner"));

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-provisioner-bootstrap-"));
  db = createDatabase(tmpDir);
});

afterEach(() => {
  if (db) {
    db.close();
    db = null;
  }
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("bootstrap treats conflicting auto-merge configuration as a warning", async () => {
  const buildSessionStore = createBuildSessionStore(db);
  const now = "2026-03-21T00:00:00.000Z";

  db.prepare(
    `INSERT INTO users (id, github_id, github_login, github_avatar_url, created_at, updated_at)
     VALUES ('user-1', 42, 'octocat', '', ?, ?)`
  ).run(now, now);
  db.prepare(
    `INSERT INTO build_sessions (id, user_id, status, prd_final, is_demo, created_at, updated_at)
     VALUES ('build-1', 'user-1', 'ready', '# PRD: Customer portal', 0, ?, ?)`
  ).run(now, now);
  db.prepare(
    `INSERT INTO oauth_grants (id, user_id, github_access_token, created_at, expires_at)
     VALUES ('grant-1', 'user-1', ?, ?, '2099-03-21T00:00:00.000Z')`
  ).run(encrypt("user-oauth-token"), now);
  db.prepare(
    `INSERT INTO build_session_refs
       (build_session_id, ref_type, ref_key, ref_value, metadata, created_at, updated_at)
     VALUES ('build-1', 'credential', 'COPILOT_GITHUB_TOKEN', ?, '{}', ?, ?)`
  ).run(encrypt("github_pat_1234567890abcdef"), now, now);

  const githubClient = {
    createRepoFromTemplate: jest.fn().mockResolvedValue({
      id: 99,
      html_url: "https://github.com/octocat/customer-portal-e2e-po-abc12345",
    }),
    waitForRepo: jest.fn().mockResolvedValue(undefined),
    checkAppInstallation: jest.fn().mockResolvedValue({
      installed: true,
      installationId: 77,
    }),
    getInstallationToken: jest.fn().mockResolvedValue("installation-token"),
    createLabel: jest.fn().mockResolvedValue(undefined),
    configureActionsPermissions: jest.fn().mockResolvedValue(undefined),
    enableAutoMerge: jest.fn().mockRejectedValue(
      new Error(
        "GitHub API PATCH https://api.github.com/repos/octocat/customer-portal-e2e-po-abc12345: 422 conflicting_auto_merge_configuration"
      )
    ),
    ensureRepoMemoryBranch: jest.fn().mockResolvedValue(undefined),
    upsertActionsVariable: jest.fn().mockResolvedValue(undefined),
    createOrUpdateActionsSecret: jest.fn().mockResolvedValue(undefined),
    ensureBranchProtection: jest.fn().mockResolvedValue(undefined),
  };

  const provisioner = createProvisioner({
    db,
    buildSessionStore,
    githubClient,
  });

  const result = await provisioner.provisionRepo("build-1", {
    repoName: "customer-portal-e2e-po-abc12345",
  });

  expect(result).toEqual({
    sessionId: "build-1",
    status: "ready_to_launch",
    installRequired: false,
  });
  expect(buildSessionStore.getSession("build-1").status).toBe("ready_to_launch");

  const warnings = db
    .prepare(
      `SELECT kind, data
       FROM build_events
       WHERE build_session_id = 'build-1' AND kind = 'bootstrap_warning'
       ORDER BY id ASC`
    )
    .all()
    .map((row) => JSON.parse(row.data).detail);

  expect(warnings).toContainEqual(
    expect.stringContaining("Auto-merge was not fully configured")
  );
});

test("bootstrap treats repo memory state.json conflicts as a warning", async () => {
  const buildSessionStore = createBuildSessionStore(db);
  const now = "2026-03-21T00:00:00.000Z";

  db.prepare(
    `INSERT INTO users (id, github_id, github_login, github_avatar_url, created_at, updated_at)
     VALUES ('user-1', 42, 'octocat', '', ?, ?)`
  ).run(now, now);
  db.prepare(
    `INSERT INTO build_sessions (id, user_id, status, prd_final, is_demo, created_at, updated_at)
     VALUES ('build-1', 'user-1', 'ready', '# PRD: Customer portal', 0, ?, ?)`
  ).run(now, now);
  db.prepare(
    `INSERT INTO oauth_grants (id, user_id, github_access_token, created_at, expires_at)
     VALUES ('grant-1', 'user-1', ?, ?, '2099-03-21T00:00:00.000Z')`
  ).run(encrypt("user-oauth-token"), now);
  db.prepare(
    `INSERT INTO build_session_refs
       (build_session_id, ref_type, ref_key, ref_value, metadata, created_at, updated_at)
     VALUES ('build-1', 'credential', 'COPILOT_GITHUB_TOKEN', ?, '{}', ?, ?)`
  ).run(encrypt("github_pat_1234567890abcdef"), now, now);

  const githubClient = {
    createRepoFromTemplate: jest.fn().mockResolvedValue({
      id: 99,
      html_url: "https://github.com/octocat/customer-portal-e2e-po-abc12345",
    }),
    waitForRepo: jest.fn().mockResolvedValue(undefined),
    checkAppInstallation: jest.fn().mockResolvedValue({
      installed: true,
      installationId: 77,
    }),
    getInstallationToken: jest.fn().mockResolvedValue("installation-token"),
    createLabel: jest.fn().mockResolvedValue(undefined),
    configureActionsPermissions: jest.fn().mockResolvedValue(undefined),
    enableAutoMerge: jest.fn().mockResolvedValue(undefined),
    ensureRepoMemoryBranch: jest.fn().mockRejectedValue(
      new Error(
        "GitHub API PUT https://api.github.com/repos/octocat/customer-portal-e2e-po-abc12345/contents/state.json: 409 conflict"
      )
    ),
    upsertActionsVariable: jest.fn().mockResolvedValue(undefined),
    createOrUpdateActionsSecret: jest.fn().mockResolvedValue(undefined),
    ensureBranchProtection: jest.fn().mockResolvedValue(undefined),
  };

  const provisioner = createProvisioner({
    db,
    buildSessionStore,
    githubClient,
  });

  const result = await provisioner.provisionRepo("build-1", {
    repoName: "customer-portal-e2e-po-abc12345",
  });

  expect(result).toEqual({
    sessionId: "build-1",
    status: "ready_to_launch",
    installRequired: false,
  });
  expect(buildSessionStore.getSession("build-1").status).toBe("ready_to_launch");

  const warnings = db
    .prepare(
      `SELECT kind, data
       FROM build_events
       WHERE build_session_id = 'build-1' AND kind = 'bootstrap_warning'
       ORDER BY id ASC`
    )
    .all()
    .map((row) => JSON.parse(row.data).detail);

  expect(warnings).toContainEqual(
    expect.stringContaining("Repo memory state was not fully updated")
  );
});
