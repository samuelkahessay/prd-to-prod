const fs = require("fs");
const os = require("os");
const path = require("path");

const { createDatabase } = require("../lib/db");
const { createBuildSessionStore } = require("../lib/build-session-store");

let db;
let store;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-build-session-store-"));
  db = createDatabase(tmpDir);
  store = createBuildSessionStore(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("ensureSession inserts a remote session stub", () => {
  const session = store.ensureSession("remote-session", {
    status: "building",
    github_repo: "octocat/example",
    app_installation_id: 123,
  });

  expect(session).toEqual(
    expect.objectContaining({
      id: "remote-session",
      status: "building",
      github_repo: "octocat/example",
      app_installation_id: 123,
    })
  );
});

test("ensureSession updates an existing mirrored session", () => {
  store.ensureSession("remote-session", {
    status: "refining",
  });

  const updated = store.ensureSession("remote-session", {
    status: "ready_to_launch",
    github_repo: "octocat/example",
    github_repo_url: "https://github.com/octocat/example",
  });

  expect(updated).toEqual(
    expect.objectContaining({
      id: "remote-session",
      status: "ready_to_launch",
      github_repo: "octocat/example",
      github_repo_url: "https://github.com/octocat/example",
    })
  );
});
