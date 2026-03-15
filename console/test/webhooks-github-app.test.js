const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { registerWebhookRoutes } = require("../routes/webhooks-github-app");

async function withServer(db, run) {
  const app = express();
  app.use("/webhooks/github-app", express.raw({ type: "application/json" }));
  registerWebhookRoutes(app, { db });

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
const secret = "test-webhook-secret";

beforeEach(() => {
  process.env.GITHUB_APP_WEBHOOK_SECRET = secret;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-webhook-"));
  db = createDatabase(tmpDir);
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
  await withServer(db, async (server) => {
    const res = await fetch(makeUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=abc",
        "X-GitHub-Event": "installation",
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

  await withServer(db, async (server) => {
    const res = await fetch(makeUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sign(secret, payload),
        "X-GitHub-Event": "installation",
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
    status: "provisioning",
  });
});
