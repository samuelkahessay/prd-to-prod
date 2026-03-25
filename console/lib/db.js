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
      github_access_token TEXT,
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
      is_demo INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS build_session_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      build_session_id TEXT NOT NULL REFERENCES build_sessions(id),
      ref_type TEXT NOT NULL,
      ref_key TEXT NOT NULL DEFAULT '',
      ref_value TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(build_session_id, ref_type, ref_key, ref_value)
    );
    CREATE INDEX IF NOT EXISTS idx_build_session_refs_session ON build_session_refs(build_session_id, ref_type, ref_key);
    CREATE INDEX IF NOT EXISTS idx_build_session_refs_lookup ON build_session_refs(ref_type, ref_key, ref_value);

    CREATE TABLE IF NOT EXISTS github_webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT '',
      repository_id INTEGER,
      installation_id INTEGER,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_github_webhook_events_repo ON github_webhook_events(repository_id, created_at);

    CREATE TABLE IF NOT EXISTS access_codes (
      code_hash TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      issuer TEXT NOT NULL DEFAULT 'system',
      payment_ref TEXT,
      memo TEXT,
      redeemed_by TEXT REFERENCES users(id),
      redeemed_at TEXT,
      build_session_id TEXT REFERENCES build_sessions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_access_codes_redeemed ON access_codes(redeemed_by);

    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      github_username TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

    -- Dedicated E2E harness tables

    CREATE TABLE IF NOT EXISTS e2e_runs (
      id TEXT PRIMARY KEY,
      lane TEXT NOT NULL,
      active_lane TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'queued',
      failure_class TEXT NOT NULL DEFAULT '',
      failure_detail TEXT NOT NULL DEFAULT '',
      build_session_id TEXT REFERENCES build_sessions(id),
      repo_full_name TEXT NOT NULL DEFAULT '',
      repo_url TEXT NOT NULL DEFAULT '',
      root_issue_number INTEGER,
      root_issue_url TEXT NOT NULL DEFAULT '',
      first_pr_number INTEGER,
      first_pr_url TEXT NOT NULL DEFAULT '',
      cleanup_mode TEXT NOT NULL DEFAULT 'auto',
      cleanup_status TEXT NOT NULL DEFAULT 'pending',
      cleanup_detail TEXT NOT NULL DEFAULT '',
      keep_repo INTEGER NOT NULL DEFAULT 0,
      cookie_jar_path TEXT NOT NULL DEFAULT '',
      report_json_path TEXT NOT NULL DEFAULT '',
      report_markdown_path TEXT NOT NULL DEFAULT '',
      artifact_refs TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_e2e_runs_status ON e2e_runs(status);
    CREATE INDEX IF NOT EXISTS idx_e2e_runs_lane ON e2e_runs(lane, created_at);
    CREATE INDEX IF NOT EXISTS idx_e2e_runs_build_session ON e2e_runs(build_session_id);

    CREATE TABLE IF NOT EXISTS e2e_run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES e2e_runs(id),
      lane TEXT NOT NULL DEFAULT '',
      step TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      evidence TEXT NOT NULL DEFAULT '{}',
      elapsed_ms INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_e2e_run_events_run ON e2e_run_events(run_id, id);

    CREATE TABLE IF NOT EXISTS e2e_auth_exports (
      id TEXT PRIMARY KEY,
      cookie_header TEXT NOT NULL,
      user_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_e2e_auth_exports_expires ON e2e_auth_exports(expires_at);
  `);

  // Safe migration for existing databases
  try {
    db.exec("ALTER TABLE build_sessions ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }

  try {
    db.exec("ALTER TABLE user_sessions ADD COLUMN github_access_token TEXT");
  } catch {
    // Column already exists — ignore
  }

  return db;
}

module.exports = { createDatabase };
