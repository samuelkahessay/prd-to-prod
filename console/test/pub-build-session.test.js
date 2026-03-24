const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { createBuildSessionStore } = require("../lib/build-session-store");
const { registerBuildSessionRoutes } = require("../routes/pub-build-session");

function makeServiceResolver() {
  return {
    forSession() {
      return {};
    },
  };
}

async function withServer(db, buildSessionStore, run) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  registerBuildSessionRoutes(app, {
    db,
    buildSessionStore,
    serviceResolver: makeServiceResolver(),
  });

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

function makeUrl(server, pathname) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}${pathname}`;
}

let db;
let buildSessionStore;
let tmpDir;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  delete process.env.ENCRYPTION_KEY;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-build-session-"));
  db = createDatabase(tmpDir);
  buildSessionStore = createBuildSessionStore(db);
});

afterEach(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  }

  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("demo session creation bootstraps an encryption key when one is missing", async () => {
  await withServer(db, buildSessionStore, async (server) => {
    const response = await fetch(makeUrl(server, "/pub/build-session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo: true }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      sessionId: expect.any(String),
    });
  });

  expect(process.env.ENCRYPTION_KEY).toMatch(/^[a-f0-9]{64}$/);
  const grantCount = db
    .prepare("SELECT COUNT(*) AS count FROM oauth_grants")
    .get().count;
  const demoBuildCount = db
    .prepare("SELECT COUNT(*) AS count FROM build_sessions WHERE is_demo = 1")
    .get().count;

  expect(grantCount).toBe(1);
  expect(demoBuildCount).toBe(1);
});
