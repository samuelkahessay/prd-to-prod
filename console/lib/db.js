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

    -- Public build flow tables

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      github_id INTEGER NOT NULL UNIQUE,
      github_login TEXT NOT NULL,
      github_avatar_url TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS oauth_grants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      github_access_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_grants_user_id ON oauth_grants(user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_grants_expires ON oauth_grants(expires_at);
    CREATE INDEX IF NOT EXISTS idx_oauth_grants_consumed ON oauth_grants(consumed_at);

    CREATE TABLE IF NOT EXISTS build_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'refining',
      github_repo TEXT,
      github_repo_id INTEGER,
      github_repo_url TEXT,
      deploy_url TEXT,
      prd_final TEXT,
      app_installation_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_build_sessions_user ON build_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_build_sessions_status ON build_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_build_sessions_repo_id ON build_sessions(github_repo_id);

    CREATE TABLE IF NOT EXISTS build_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      build_session_id TEXT NOT NULL REFERENCES build_sessions(id),
      category TEXT NOT NULL,
      kind TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_build_events_session ON build_events(build_session_id, id);
  `);

  return db;
}

module.exports = { createDatabase };
