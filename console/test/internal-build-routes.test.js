const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { createBuildSessionStore } = require("../lib/build-session-store");
const { registerInternalBuildRoutes } = require("../routes/internal-build");

async function withServer(db, buildSessionStore, run) {
  const app = express();
  app.use(express.json());
  registerInternalBuildRoutes(app, { buildSessionStore, serviceResolver });

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
let buildSessionStore;
let serviceResolver;
let githubClient;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-internal-build-"));
  db = createDatabase(tmpDir);
  buildSessionStore = createBuildSessionStore(db);
  githubClient = {
    getInstallationToken: jest.fn().mockResolvedValue("installation-token"),
    upsertActionsVariable: jest.fn().mockResolvedValue(undefined),
  };
  serviceResolver = {
    forSession() {
      return { githubClient };
    },
  };

  db.prepare(
    `INSERT INTO build_sessions (id, status, github_repo, app_installation_id, deploy_url, created_at, updated_at)
     VALUES
     ('complete-build', 'complete', 'octocat/complete-build', 101, 'https://example.com', '2026-03-20T00:00:00Z', '2026-03-20T00:00:00Z'),
     ('handoff-build', 'handoff_ready', 'octocat/handoff-build', 102, NULL, '2026-03-20T00:00:00Z', '2026-03-20T00:00:00Z'),
     ('building-build', 'building', 'octocat/building-build', 103, NULL, '2026-03-20T00:00:00Z', '2026-03-20T00:00:00Z'),
     ('ready-build', 'ready_to_launch', 'octocat/ready-build', 104, NULL, '2026-03-20T00:00:00Z', '2026-03-20T00:00:00Z')`
  ).run();
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("handoff_ready callback does not regress a complete session", async () => {
  await withServer(db, buildSessionStore, async (server) => {
    const response = await fetch(makeUrl(server, "/internal/build-callback"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: "complete-build",
        category: "delivery",
        kind: "handoff_ready",
        data: {
          detail: "Late handoff callback",
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  const session = buildSessionStore.getSession("complete-build");
  expect(session.status).toBe("complete");
  expect(session.deploy_url).toBe("https://example.com");
  expect(githubClient.getInstallationToken).not.toHaveBeenCalled();
  expect(githubClient.upsertActionsVariable).not.toHaveBeenCalled();
});

test("complete callback upgrades a handoff_ready session", async () => {
  await withServer(db, buildSessionStore, async (server) => {
    const response = await fetch(makeUrl(server, "/internal/build-callback"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: "handoff-build",
        category: "delivery",
        kind: "complete",
        data: {
          deploy_url: "https://validated.example.com",
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  const session = buildSessionStore.getSession("handoff-build");
  expect(session.status).toBe("complete");
  expect(session.deploy_url).toBe("https://validated.example.com");
  expect(githubClient.getInstallationToken).toHaveBeenCalledWith(102);
  expect(githubClient.upsertActionsVariable).toHaveBeenCalledWith(
    "installation-token",
    "octocat",
    "handoff-build",
    expect.objectContaining({
      name: "PIPELINE_ACTIVE",
      value: "false",
    })
  );
});

test("handoff_ready callback deactivates the pipeline for a building session", async () => {
  await withServer(db, buildSessionStore, async (server) => {
    const response = await fetch(makeUrl(server, "/internal/build-callback"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: "building-build",
        category: "delivery",
        kind: "handoff_ready",
        data: {
          detail: "Repo handoff is ready",
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  const session = buildSessionStore.getSession("building-build");
  expect(session.status).toBe("handoff_ready");
  expect(githubClient.getInstallationToken).toHaveBeenCalledWith(103);
  expect(githubClient.upsertActionsVariable).toHaveBeenCalledWith(
    "installation-token",
    "octocat",
    "building-build",
    expect.objectContaining({
      name: "PIPELINE_ACTIVE",
      value: "false",
    })
  );
});

test("build-release stalls a launchable session and deactivates the pipeline", async () => {
  await withServer(db, buildSessionStore, async (server) => {
    const response = await fetch(makeUrl(server, "/internal/build-release"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: "ready-build",
        detail: "Released by E2E cleanup.",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      released: true,
      status: "stalled",
    });
  });

  const session = buildSessionStore.getSession("ready-build");
  expect(session.status).toBe("stalled");

  const latestEvent = buildSessionStore.getEvents("ready-build").at(-1);
  expect(latestEvent.kind).toBe("capacity_released");
  expect(latestEvent.data.detail).toBe("Released by E2E cleanup.");

  expect(githubClient.getInstallationToken).toHaveBeenCalledWith(104);
  expect(githubClient.upsertActionsVariable).toHaveBeenCalledWith(
    "installation-token",
    "octocat",
    "ready-build",
    expect.objectContaining({
      name: "PIPELINE_ACTIVE",
      value: "false",
    })
  );
});
