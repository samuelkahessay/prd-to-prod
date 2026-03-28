const Database = require("better-sqlite3");
const { purgeStaleData } = require("../lib/data-cleanup");
const { createDatabase } = require("../lib/db");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let db;
const testDir = path.join(__dirname, ".test-data-cleanup");

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
  db = createDatabase(testDir);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO users (id, github_id, github_login, github_avatar_url, created_at, updated_at)
     VALUES ('user-1', 0, 'test', '', ?, ?)`
  ).run(now, now);
});

afterAll(() => {
  db.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

function insertWebhookEvent(createdAt) {
  db.prepare(
    `INSERT INTO github_webhook_events
       (delivery_id, event_name, action, repository_id, installation_id, payload, created_at)
     VALUES (?, 'push', '', 123, 456, '{}', ?)`
  ).run(crypto.randomUUID(), createdAt);
}

function insertBuildSession(id, { isDemo = false, status = "complete", createdAt }) {
  db.prepare(
    `INSERT INTO build_sessions (id, user_id, status, is_demo, created_at, updated_at)
     VALUES (?, 'user-1', ?, ?, ?, ?)`
  ).run(id, status, isDemo ? 1 : 0, createdAt, createdAt);
}

function insertBuildEvent(sessionId) {
  db.prepare(
    `INSERT INTO build_events (build_session_id, category, kind, data, created_at)
     VALUES (?, 'chat', 'user_message', '{}', ?)`
  ).run(sessionId, new Date().toISOString());
}

test("purges webhook events older than max age", () => {
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const recent = new Date().toISOString();

  insertWebhookEvent(old);
  insertWebhookEvent(old);
  insertWebhookEvent(recent);

  const before = db.prepare("SELECT COUNT(*) as c FROM github_webhook_events").get().c;

  const result = purgeStaleData(db, {
    webhookMaxAgeMs: 24 * 60 * 60 * 1000,
  });

  expect(result.webhooks).toBe(2);
  const after = db.prepare("SELECT COUNT(*) as c FROM github_webhook_events").get().c;
  expect(after).toBe(before - 2);
});

test("purges completed demo sessions older than build max age", () => {
  const oldDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const sessionId = crypto.randomUUID();

  insertBuildSession(sessionId, { isDemo: true, createdAt: oldDate });
  insertBuildEvent(sessionId);

  const result = purgeStaleData(db, {
    buildMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  });

  expect(result.buildSessions).toBeGreaterThanOrEqual(1);
  expect(result.buildEvents).toBeGreaterThanOrEqual(1);

  const session = db.prepare("SELECT * FROM build_sessions WHERE id = ?").get(sessionId);
  expect(session).toBeUndefined();
});

test("does not purge active (refining) sessions", () => {
  const oldDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const sessionId = crypto.randomUUID();

  insertBuildSession(sessionId, { status: "refining", createdAt: oldDate });

  const result = purgeStaleData(db, {
    buildMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  });

  const session = db.prepare("SELECT * FROM build_sessions WHERE id = ?").get(sessionId);
  expect(session).toBeDefined();
});
