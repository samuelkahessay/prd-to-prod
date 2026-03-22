const fs = require("fs");
const os = require("os");
const path = require("path");

const { encrypt } = require("../lib/crypto");
const { createDatabase } = require("../lib/db");
const { createBuildSessionStore } = require("../lib/build-session-store");
const { createProvisioner } = require("../lib/provisioner");

let tmpDir;
let db;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
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
  if (originalEncryptionKey === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  }
});

test("createPrdIssue is idempotent once the pipeline issue has been created", async () => {
  const buildSessionStore = {
    getSession: jest.fn().mockReturnValue({
      id: "build-1",
      prd_final: "# PRD: Customer portal\n\n## Problem\n\nSupport requests get lost\n",
      github_repo: "octocat/customer-portal",
    }),
    getRefs: jest
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          ref_value: "17",
          metadata: {
            issueUrl: "https://github.com/octocat/customer-portal/issues/17",
          },
        },
      ]),
    upsertRef: jest.fn(),
    appendEvent: jest.fn(),
  };
  const githubClient = {
    getInstallationToken: jest.fn().mockResolvedValue("installation-token"),
    createIssue: jest.fn().mockResolvedValue({
      number: 17,
      html_url: "https://github.com/octocat/customer-portal/issues/17",
    }),
  };

  const provisioner = createProvisioner({
    db: {},
    buildSessionStore,
    githubClient,
  });

  await provisioner.createPrdIssue("build-1", 99);
  const result = await provisioner.createPrdIssue("build-1", 99);

  expect(githubClient.createIssue).toHaveBeenCalledTimes(1);
  expect(githubClient.createIssue).toHaveBeenCalledWith(
    "installation-token",
    "octocat",
    "customer-portal",
    expect.objectContaining({
      title: "[Pipeline] Customer portal",
      body: "/decompose\n\n# PRD: Customer portal\n\n## Problem\n\nSupport requests get lost",
      labels: ["pipeline"],
    })
  );
  expect(buildSessionStore.appendEvent).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    number: 17,
    html_url: "https://github.com/octocat/customer-portal/issues/17",
  });
});

test("provisionRepo uses an explicit repo override for temp e2e sessions", async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-provisioner-"));
  db = createDatabase(tmpDir);
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

  const githubClient = {
    createRepoFromTemplate: jest.fn().mockResolvedValue({
      id: 99,
      html_url: "https://github.com/octocat/customer-portal-e2e-po-abc12345",
    }),
    waitForRepo: jest.fn().mockResolvedValue(undefined),
    checkAppInstallation: jest.fn().mockResolvedValue({
      installed: false,
    }),
  };

  const provisioner = createProvisioner({
    db,
    buildSessionStore,
    githubClient,
  });

  const result = await provisioner.provisionRepo("build-1", {
    repoName: "Customer Portal E2E Po ABC12345",
  });

  expect(githubClient.createRepoFromTemplate).toHaveBeenCalledWith(
    "user-oauth-token",
    expect.objectContaining({
      owner: "octocat",
      name: "customer-portal-e2e-po-abc12345",
    })
  );
  expect(buildSessionStore.getSession("build-1").github_repo).toBe(
    "octocat/customer-portal-e2e-po-abc12345"
  );
  expect(result).toEqual({
    sessionId: "build-1",
    status: "awaiting_install",
    installRequired: true,
    installUrl: "https://github.com/apps/prd-to-prod-pipeline/installations/new?target_id=42",
  });
});
