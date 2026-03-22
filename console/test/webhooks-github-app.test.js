const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { createBuildSessionStore } = require("../lib/build-session-store");
const { registerWebhookRoutes } = require("../routes/webhooks-github-app");

async function withServer(db, buildSessionStore, serviceResolver, run) {
  const app = express();
  app.use("/webhooks/github-app", express.raw({ type: "application/json" }));
  registerWebhookRoutes(app, { db, buildSessionStore, serviceResolver });

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

function sign(secret, payload) {
  return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function makeUrl(server) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}/webhooks/github-app`;
}

let db;
let tmpDir;
let buildSessionStore;
let resumeAppBootstrap;
let serviceResolver;
const secret = "test-webhook-secret";

beforeEach(() => {
  process.env.GITHUB_APP_WEBHOOK_SECRET = secret;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-webhook-"));
  db = createDatabase(tmpDir);
  buildSessionStore = createBuildSessionStore(db);
  resumeAppBootstrap = jest.fn().mockImplementation(async (sessionId, installationId) => {
    buildSessionStore.updateSession(sessionId, {
      app_installation_id: installationId,
      status: "ready_to_launch",
    });
  });
  serviceResolver = {
    forSession() {
      return {
        provisioner: { resumeAppBootstrap },
      };
    },
  };
  db.prepare(
    `INSERT INTO build_sessions (id, status, github_repo_id, created_at, updated_at)
     VALUES ('build-1', 'awaiting_install', 123, '2026-03-13T00:00:00Z', '2026-03-13T00:00:00Z')`
  ).run();
});

afterEach(() => {
  delete process.env.GITHUB_APP_WEBHOOK_SECRET;
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("invalid signature returns 401 instead of throwing", async () => {
  await withServer(db, buildSessionStore, serviceResolver, async (server) => {
    const res = await fetch(makeUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=abc",
        "X-GitHub-Event": "installation",
        "X-GitHub-Delivery": "delivery-invalid",
      },
      body: JSON.stringify({ action: "created" }),
    });

    expect(res.status).toBe(401);
  });
});

test("valid installation event updates awaiting build session", async () => {
  const payload = JSON.stringify({
    action: "created",
    installation: { id: 999 },
    repositories: [{ id: 123 }],
  });

  await withServer(db, buildSessionStore, serviceResolver, async (server) => {
    const res = await fetch(makeUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sign(secret, payload),
        "X-GitHub-Event": "installation",
        "X-GitHub-Delivery": "delivery-install-1",
      },
      body: payload,
    });

    expect(res.status).toBe(200);
  });

  const session = db
    .prepare("SELECT app_installation_id, status FROM build_sessions WHERE id = 'build-1'")
    .get();
  expect(session).toEqual({
    app_installation_id: 999,
    status: "ready_to_launch",
  });
  expect(resumeAppBootstrap).toHaveBeenCalledWith("build-1", 999);
});

test("workflow_run failure marks the session stalled", async () => {
  db.prepare(
    `UPDATE build_sessions
     SET status = 'building', app_installation_id = 999
     WHERE id = 'build-1'`
  ).run();

  const payload = JSON.stringify({
    action: "completed",
    installation: { id: 999 },
    repository: { id: 123 },
    workflow_run: {
      id: 456,
      name: "PRD Decomposer",
      status: "completed",
      conclusion: "failure",
      html_url: "https://github.com/octocat/repo/actions/runs/456",
    },
  });

  await withServer(db, buildSessionStore, serviceResolver, async (server) => {
    const res = await fetch(makeUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sign(secret, payload),
        "X-GitHub-Event": "workflow_run",
        "X-GitHub-Delivery": "delivery-workflow-1",
      },
      body: payload,
    });

    expect(res.status).toBe(200);
  });

  const session = db
    .prepare("SELECT status FROM build_sessions WHERE id = 'build-1'")
    .get();
  expect(session).toEqual({ status: "stalled" });

  const latestEvent = buildSessionStore.getEvents("build-1").at(-1);
  expect(latestEvent.kind).toBe("pipeline_stalled");
  expect(latestEvent.data.stage).toBe("decompose");
});

test("validate-deployment success without a production URL marks handoff_ready", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  db.prepare(
    `UPDATE build_sessions
     SET status = 'building', app_installation_id = 999
     WHERE id = 'build-1'`
  ).run();

  const payload = JSON.stringify({
    action: "completed",
    installation: { id: 999 },
    repository: { id: 123 },
    workflow_run: {
      id: 789,
      name: "Validate Deployment",
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/octocat/repo/actions/runs/789",
    },
  });

  await withServer(db, buildSessionStore, serviceResolver, async (server) => {
    const res = await fetch(makeUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sign(secret, payload),
        "X-GitHub-Event": "workflow_run",
        "X-GitHub-Delivery": "delivery-workflow-2",
      },
      body: payload,
    });

    expect(res.status).toBe(200);
  });

  const session = db
    .prepare("SELECT status, deploy_url FROM build_sessions WHERE id = 'build-1'")
    .get();
  expect(session).toEqual({
    status: "handoff_ready",
    deploy_url: null,
  });

  const latestEvents = buildSessionStore.getEvents("build-1").slice(-2);
  expect(latestEvents.map((event) => event.kind)).toEqual([
    "deployment_skipped",
    "handoff_ready",
  ]);
  expect(consoleError).not.toHaveBeenCalled();
});

test("third implementation workflow failure emits provider_retry_exhausted", async () => {
  db.prepare(
    `UPDATE build_sessions
     SET status = 'building', app_installation_id = 999
     WHERE id = 'build-1'`
  ).run();

  buildSessionStore.upsertRef("build-1", {
    type: "workflow_run",
    key: "Pipeline Repo Assist",
    value: "101",
    metadata: { conclusion: "failure" },
  });
  buildSessionStore.upsertRef("build-1", {
    type: "workflow_run",
    key: "Pipeline Repo Assist",
    value: "102",
    metadata: { conclusion: "timed_out" },
  });

  const payload = JSON.stringify({
    action: "completed",
    installation: { id: 999 },
    repository: { id: 123 },
    workflow_run: {
      id: 103,
      name: "Pipeline Repo Assist",
      status: "completed",
      conclusion: "failure",
      html_url: "https://github.com/octocat/repo/actions/runs/103",
    },
  });

  await withServer(db, buildSessionStore, serviceResolver, async (server) => {
    const res = await fetch(makeUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sign(secret, payload),
        "X-GitHub-Event": "workflow_run",
        "X-GitHub-Delivery": "delivery-workflow-3",
      },
      body: payload,
    });

    expect(res.status).toBe(200);
  });

  const latestEvent = buildSessionStore.getEvents("build-1").at(-1);
  expect(latestEvent.kind).toBe("provider_retry_exhausted");
  expect(latestEvent.data).toEqual(
    expect.objectContaining({
      stage: "implementation",
      attemptCount: 3,
    })
  );
});
