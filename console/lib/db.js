const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function createDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "console.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      mode TEXT NOT NULL,
      input_source TEXT NOT NULL,
      target_repo TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      timestamp TEXT NOT NULL,
      stage TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      kind TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
    CREATE INDEX IF NOT EXISTS idx_run_events_type ON run_events(type);

    CREATE TABLE IF NOT EXISTS queue_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      source_event_id TEXT NOT NULL REFERENCES run_events(id),
      event TEXT NOT NULL,
      ref TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL,
      policy_rule TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      queued_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT,
      resolution TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id),
      FOREIGN KEY (source_event_id) REFERENCES run_events(id)
    );

    CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status);
    CREATE INDEX IF NOT EXISTS idx_queue_items_run_id ON queue_items(run_id);
  `);

  return db;
}

module.exports = { createDatabase };
