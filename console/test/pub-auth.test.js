const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { registerPubAuthRoutes, resolveOAuthGrantTtlMs } = require("../routes/pub-auth");

async function withServer(db, run) {
  const app = express();
  app.use(cookieParser());
  registerPubAuthRoutes(app, { db });

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
let originalFetch;
const envBackup = {
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL,
  GITHUB_OAUTH_CLIENT_ID: process.env.GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  GITHUB_OAUTH_GRANT_TTL_MS: process.env.GITHUB_OAUTH_GRANT_TTL_MS,
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-pub-auth-"));
  db = createDatabase(tmpDir);
  originalFetch = global.fetch;

  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.FRONTEND_URL = "http://localhost:3001";
  process.env.GITHUB_OAUTH_CLIENT_ID = "client-id";
  process.env.GITHUB_OAUTH_CLIENT_SECRET = "client-secret";
  delete process.env.GITHUB_OAUTH_GRANT_TTL_MS;
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("resolveOAuthGrantTtlMs defaults to one hour", () => {
  expect(resolveOAuthGrantTtlMs()).toBe(60 * 60 * 1000);
});

test("oauth callback stores a one-hour provisioning grant by default", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ access_token: "gho_test_token" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 42,
        login: "octocat",
        avatar_url: "https://avatars.example/octocat.png",
      }),
    });

  await withServer(db, async (server) => {
    const response = await originalFetch(
      makeUrl(server, "/pub/auth/github/callback?code=oauth-code&state=state-123"),
      {
        headers: {
          Cookie: "oauth_state=state-123; oauth_return_to=/build?session=session-1",
        },
        redirect: "manual",
      }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/build?session=session-1"
    );
  });

  const grant = db
    .prepare("SELECT created_at, expires_at FROM oauth_grants ORDER BY created_at DESC LIMIT 1")
    .get();

  const ttl = Date.parse(grant.expires_at) - Date.parse(grant.created_at);
  expect(ttl).toBeGreaterThanOrEqual(60 * 60 * 1000);
  expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000 + 50);
});
