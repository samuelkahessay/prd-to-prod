const { createDatabase } = require("../lib/db");
const fs = require("fs");
const path = require("path");
const os = require("os");

let db;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-test-"));
  db = createDatabase(tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("creates all tables", () => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);
  expect(tables).toContain("runs");
  expect(tables).toContain("run_events");
  expect(tables).toContain("queue_items");
});

test("foreign key enforcement is on", () => {
  const fk = db.prepare("PRAGMA foreign_keys").get();
  expect(fk.foreign_keys).toBe(1);
});

test("inserting a queue_item with invalid run_id fails", () => {
  expect(() => {
    db.prepare(
      `INSERT INTO queue_items (id, run_id, source_event_id, event, reason, queued_at)
       VALUES ('q1', 'nonexistent', 'e1', 'test', 'test', '2026-01-01T00:00:00Z')`
    ).run();
  }).toThrow();
});
