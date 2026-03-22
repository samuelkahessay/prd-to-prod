const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createAccessCodeStore } = require("../lib/access-codes");
const { createDatabase } = require("../lib/db");
const { registerInternalAccessCodeRoutes } = require("../routes/internal-access-codes");

let db;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-internal-access-codes-"));
  db = createDatabase(tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("internal access-code route mints codes in the shared database", async () => {
  const app = express();
  app.use(express.json());
  registerInternalAccessCodeRoutes(app, { db });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/internal/access-codes/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        count: 2,
        issuer: "jest",
        memo: "run=test",
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.codes).toHaveLength(2);
    expect(payload.codes[0]).toMatch(/^BETA-[A-Z0-9_-]{8}$/);

    const codes = createAccessCodeStore(db).list({ unused: true });
    expect(codes).toHaveLength(2);
    expect(codes[0]).toEqual(
      expect.objectContaining({
        issuer: "jest",
        memo: "run=test",
      })
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
