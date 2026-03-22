const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { createUserSession } = require("../lib/auth-store");
const { registerE2ERunRoutes } = require("../routes/api-e2e-runs");
const { registerE2EStreamRoutes } = require("../routes/api-e2e-stream");
const { registerE2EAuthRoutes } = require("../routes/api-e2e-auth");

let db;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-e2e-routes-"));
  db = createDatabase(tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function withServer(harness, run) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", (req, _res, next) => {
    req.operatorId = "dev-operator";
    next();
  });

  registerE2ERunRoutes(app, { harness });
  registerE2EStreamRoutes(app, { harness });
  registerE2EAuthRoutes(app, { harness, db });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    await run(server);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function makeUrl(server, suffix) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}${suffix}`;
}

test("run routes create, list, and fetch e2e runs", async () => {
  const createdRun = {
    id: "run-1",
    lane: "provision-only",
    status: "queued",
    activeLane: "provision-only",
    cleanupStatus: "pending",
  };
  const harness = {
    isDashboardLaunchable: jest.fn().mockReturnValue(true),
    launchRun: jest.fn().mockResolvedValue(createdRun),
    listRuns: jest.fn().mockReturnValue([createdRun]),
    getRun: jest.fn().mockReturnValue({ ...createdRun, events: [] }),
    cleanupRun: jest.fn().mockResolvedValue({ ...createdRun, cleanupStatus: "deleted" }),
    validateAuth: jest.fn(),
    exportAuthCookie: jest.fn(),
  };

  await withServer(harness, async (server) => {
    const startRes = await fetch(makeUrl(server, "/api/e2e/runs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lane: "provision-only" }),
    });
    expect(startRes.status).toBe(202);
    expect(await startRes.json()).toEqual({
      runId: "run-1",
      run: createdRun,
    });

    const listRes = await fetch(makeUrl(server, "/api/e2e/runs"));
    expect(await listRes.json()).toEqual({ runs: [createdRun] });

    const getRes = await fetch(makeUrl(server, "/api/e2e/runs/run-1"));
    expect(await getRes.json()).toEqual({ ...createdRun, events: [] });

    const cleanupRes = await fetch(makeUrl(server, "/api/e2e/runs/run-1/cleanup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    expect((await cleanupRes.json()).run.cleanupStatus).toBe("deleted");
  });
});

test("report route returns report contents from disk", async () => {
  const reportJsonPath = path.join(tmpDir, "report.json");
  const reportMarkdownPath = path.join(tmpDir, "report.md");
  fs.writeFileSync(reportJsonPath, JSON.stringify({ ok: true }));
  fs.writeFileSync(reportMarkdownPath, "# report\n");

  const harness = {
    isDashboardLaunchable: jest.fn().mockReturnValue(true),
    launchRun: jest.fn(),
    listRuns: jest.fn(),
    getRun: jest.fn().mockReturnValue({
      id: "run-1",
      reportJsonPath,
      reportMarkdownPath,
    }),
    cleanupRun: jest.fn(),
    validateAuth: jest.fn(),
    exportAuthCookie: jest.fn(),
  };

  await withServer(harness, async (server) => {
    const res = await fetch(makeUrl(server, "/api/e2e/runs/run-1/report"));
    expect(await res.json()).toEqual({
      reportJsonPath,
      reportMarkdownPath,
      reportJson: { ok: true },
      reportMarkdown: "# report\n",
    });
  });
});

test("auth-cookie route exports and validates real build-session cookies", async () => {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, github_id, github_login, github_avatar_url, created_at, updated_at)
     VALUES ('user-1', 42, 'octocat', 'https://example.com/octocat.png', ?, ?)`
  ).run(now, now);
  const browserSessionId = createUserSession(db, {
    userId: "user-1",
    createdAt: now,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    sessionId: "build-session-1",
  });

  const harness = {
    isDashboardLaunchable: jest.fn(),
    launchRun: jest.fn(),
    listRuns: jest.fn(),
    getRun: jest.fn(),
    cleanupRun: jest.fn(),
    validateAuth: jest.fn().mockResolvedValue({
      cookieJarPath: "/tmp/e2e-cookiejar",
      user: { githubLogin: "octocat" },
    }),
    exportAuthCookie: jest.fn().mockReturnValue({
      cookieJarPath: "/tmp/e2e-cookiejar",
    }),
    authBootstrapUrl: jest.fn().mockReturnValue("http://127.0.0.1:3001/console/e2e/auth"),
  };

  await withServer(harness, async (server) => {
    const exportRes = await fetch(makeUrl(server, "/pub/e2e/auth-cookie"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `build_session=${browserSessionId}`,
      },
      body: JSON.stringify({ path: "/tmp/e2e-cookiejar" }),
    });

    expect(exportRes.status).toBe(200);
    expect(await exportRes.json()).toEqual({
      ok: true,
      cookieJarPath: "/tmp/e2e-cookiejar",
      authBootstrapUrl: "http://127.0.0.1:3001/console/e2e/auth",
    });
    expect(harness.exportAuthCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        cookieJarPath: "/tmp/e2e-cookiejar",
        cookieHeader: "build_session=build-session-1",
      })
    );

    const validateRes = await fetch(
      makeUrl(server, "/pub/e2e/auth-cookie?path=%2Ftmp%2Fe2e-cookiejar")
    );
    expect(validateRes.status).toBe(200);
    expect(await validateRes.json()).toEqual({
      ok: true,
      cookieJarPath: "/tmp/e2e-cookiejar",
      user: { githubLogin: "octocat" },
    });
  });
});
