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
     ('owned-build', 'user-1', 'provisioning', 101, '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z'),
     ('foreign-ready', 'user-2', 'ready', NULL, '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z'),
     ('foreign-build', 'user-2', 'provisioning', 202, '2026-03-14T00:00:00Z', '2026-03-14T00:00:00Z')`
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
  expect(buildRunner.dispatchBuild).not.toHaveBeenCalled();
});

test("start-build allows the owning user to continue a provisioning session", async () => {
  const provisioner = {
    provisionRepo: jest.fn(),
    createPrdIssue: jest.fn().mockResolvedValue(undefined),
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
    });
  });

  expect(provisioner.createPrdIssue).toHaveBeenCalledWith("owned-build", 101);
  // buildRunner.dispatchBuild is only called for demo sessions —
  // real sessions rely on the pipeline's /decompose flow
  expect(buildRunner.dispatchBuild).not.toHaveBeenCalled();
});
