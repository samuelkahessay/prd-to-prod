const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { registerProvisionRoutes } = require("../routes/pub-provision");

function wrapAsServiceResolver({ provisioner, buildRunner }) {
  return {
    forSession() {
      return { provisioner, buildRunner };
    },
  };
}

async function withServer(db, routes, run) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  registerProvisionRoutes(app, { db, serviceResolver: wrapAsServiceResolver(routes) });

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
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-provision-"));
  db = createDatabase(tmpDir);

  db.prepare(
    `INSERT INTO users (id, github_id, github_login, github_avatar_url, created_at, updated_at)
     VALUES
     ('user-1', 1, 'alpha', '', '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z'),
     ('user-2', 2, 'beta', '', '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z')`
  ).run();

  db.prepare(
    `INSERT INTO user_sessions (id, user_id, created_at, expires_at)
     VALUES ('session-1', 'user-1', '2026-03-14T00:00:00Z', '2099-03-14T00:00:00Z')`
  ).run();

  db.prepare(
    `INSERT INTO build_sessions (id, user_id, status, app_installation_id, created_at, updated_at)
     VALUES
     ('owned-build', 'user-1', 'ready_to_launch', 101, '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z'),
     ('foreign-ready', 'user-2', 'ready', NULL, '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z'),
     ('foreign-build', 'user-2', 'ready_to_launch', 202, '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z')`
  ).run();

  // BYOK credential for owned-build so start-build gate passes
  db.prepare(
    `INSERT INTO build_session_refs (build_session_id, ref_type, ref_key, ref_value, metadata, created_at, updated_at)
     VALUES ('owned-build', 'credential', 'COPILOT_GITHUB_TOKEN', 'encrypted-stub', '{}', '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z')`
  ).run();

  // Access code redeemed by user-1 for owned-build so provision gate passes
  db.prepare(
    `INSERT INTO access_codes (code_hash, created_at, issuer, redeemed_by, redeemed_at, build_session_id)
     VALUES ('test-hash', '2026-03-14T00:00:00Z', 'test', 'user-1', '2026-03-14T00:00:00Z', 'owned-build')`
  ).run();
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("provision rejects a build session owned by another user", async () => {
  const provisioner = {
    provisionRepo: jest.fn(),
    createPrdIssue: jest.fn(),
    launchPipeline: jest.fn(),
  };
  const buildRunner = {
    dispatchBuild: jest.fn(),
  };

  await withServer(db, { provisioner, buildRunner }, async (server) => {
    const response = await fetch(makeUrl(server, "/pub/build-session/foreign-ready/provision"), {
      method: "POST",
      headers: {
        Cookie: "build_session=session-1",
      },
    });

    expect(response.status).toBe(404);
  });

  expect(provisioner.provisionRepo).not.toHaveBeenCalled();
});

test("start-build rejects a build session owned by another user", async () => {
  const provisioner = {
    provisionRepo: jest.fn(),
    createPrdIssue: jest.fn(),
    launchPipeline: jest.fn(),
  };
  const buildRunner = {
    dispatchBuild: jest.fn(),
  };

  await withServer(db, { provisioner, buildRunner }, async (server) => {
    const response = await fetch(makeUrl(server, "/pub/build-session/foreign-build/start-build"), {
      method: "POST",
      headers: {
        Cookie: "build_session=session-1",
      },
    });

    expect(response.status).toBe(404);
  });

  expect(provisioner.createPrdIssue).not.toHaveBeenCalled();
  expect(provisioner.launchPipeline).not.toHaveBeenCalled();
  expect(buildRunner.dispatchBuild).not.toHaveBeenCalled();
});

test("start-build launches the target repo pipeline for real sessions", async () => {
  const provisioner = {
    provisionRepo: jest.fn(),
    createPrdIssue: jest.fn().mockResolvedValue(undefined),
    launchPipeline: jest.fn().mockResolvedValue({
      sessionId: "owned-build",
      status: "building",
      rootIssueNumber: 17,
    }),
  };
  const buildRunner = {
    dispatchBuild: jest.fn().mockResolvedValue(undefined),
  };

  await withServer(db, { provisioner, buildRunner }, async (server) => {
    const response = await fetch(makeUrl(server, "/pub/build-session/owned-build/start-build"), {
      method: "POST",
      headers: {
        Cookie: "build_session=session-1",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: "owned-build",
      status: "building",
      rootIssueNumber: 17,
    });
  });

  expect(provisioner.launchPipeline).toHaveBeenCalledWith("owned-build");
  expect(buildRunner.dispatchBuild).not.toHaveBeenCalled();
});
