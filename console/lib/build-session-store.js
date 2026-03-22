const crypto = require("crypto");
const { EventEmitter } = require("events");

function createBuildSessionStore(db) {
  const emitters = new Map();

  function getEmitter(sessionId) {
    if (!emitters.has(sessionId)) {
      emitters.set(sessionId, new EventEmitter());
    }
    return emitters.get(sessionId);
  }

  return {
    createSession(userId, { isDemo = false } = {}) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO build_sessions (id, user_id, status, is_demo, created_at, updated_at)
         VALUES (?, ?, 'refining', ?, ?, ?)`
      ).run(id, userId || null, isDemo ? 1 : 0, now, now);
      return this.getSession(id);
    },

    ensureSession(id, fields = {}) {
      const existing = this.getSession(id);
      if (!existing) {
        const now = new Date().toISOString();
        db.prepare(
          `INSERT INTO build_sessions (
             id, user_id, status, is_demo, github_repo, github_repo_id, github_repo_url,
             deploy_url, prd_final, app_installation_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          fields.user_id || null,
          fields.status || "refining",
          fields.is_demo ? 1 : 0,
          fields.github_repo || null,
          fields.github_repo_id || null,
          fields.github_repo_url || null,
          fields.deploy_url || null,
          fields.prd_final || null,
          fields.app_installation_id || null,
          now,
          now
        );
      }

      this.updateSession(id, fields);
      return this.getSession(id);
    },

    getSession(id) {
      return db
        .prepare("SELECT * FROM build_sessions WHERE id = ?")
        .get(id);
    },

    updateSession(id, fields) {
      const allowed = [
        "status",
        "user_id",
        "github_repo",
        "github_repo_id",
        "github_repo_url",
        "deploy_url",
        "prd_final",
        "app_installation_id",
      ];
      const sets = [];
      const values = [];
      for (const [key, value] of Object.entries(fields)) {
        if (allowed.includes(key)) {
          sets.push(`${key} = ?`);
          values.push(value);
        }
      }
      if (sets.length === 0) return;
      sets.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);
      db.prepare(
        `UPDATE build_sessions SET ${sets.join(", ")} WHERE id = ?`
      ).run(...values);
    },

    appendEvent(sessionId, { category, kind, data }) {
      const now = new Date().toISOString();
      const result = db.prepare(
        `INSERT INTO build_events (build_session_id, category, kind, data, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(sessionId, category, kind, JSON.stringify(data || {}), now);

      const event = {
        id: result.lastInsertRowid,
        build_session_id: sessionId,
        category,
        kind,
        data: data || {},
        created_at: now,
      };

      getEmitter(sessionId).emit("event", event);
      return event;
    },

    getEvents(sessionId, { afterId = 0, category } = {}) {
      if (category) {
        return db
          .prepare(
            `SELECT * FROM build_events
             WHERE build_session_id = ? AND id > ? AND category = ?
             ORDER BY id ASC`
          )
          .all(sessionId, afterId, category)
          .map(parseEventRow);
      }
      return db
        .prepare(
          `SELECT * FROM build_events
           WHERE build_session_id = ? AND id > ?
           ORDER BY id ASC`
        )
        .all(sessionId, afterId)
        .map(parseEventRow);
    },

    getChatMessages(sessionId) {
      return db
        .prepare(
          `SELECT * FROM build_events
           WHERE build_session_id = ? AND category = 'chat'
           ORDER BY id ASC`
        )
        .all(sessionId)
        .map(parseEventRow);
    },

    subscribe(sessionId, callback) {
      const emitter = getEmitter(sessionId);
      emitter.on("event", callback);
      return () => {
        emitter.off("event", callback);
        if (emitter.listenerCount("event") === 0) {
          emitters.delete(sessionId);
        }
      };
    },

    countSessionsByStatuses(statuses) {
      if (!Array.isArray(statuses) || statuses.length === 0) {
        return 0;
      }

      const placeholders = statuses.map(() => "?").join(", ");
      const row = db
        .prepare(
          `SELECT COUNT(*) AS total
           FROM build_sessions
           WHERE status IN (${placeholders})`
        )
        .get(...statuses);
      return row?.total || 0;
    },

    findSessionByRepoId(repoId, { statuses } = {}) {
      if (!repoId) {
        return null;
      }

      if (Array.isArray(statuses) && statuses.length > 0) {
        const placeholders = statuses.map(() => "?").join(", ");
        return db
          .prepare(
            `SELECT *
             FROM build_sessions
             WHERE github_repo_id = ? AND status IN (${placeholders})
             ORDER BY updated_at DESC
             LIMIT 1`
          )
          .get(repoId, ...statuses);
      }

      return db
        .prepare(
          `SELECT *
           FROM build_sessions
           WHERE github_repo_id = ?
           ORDER BY updated_at DESC
           LIMIT 1`
        )
        .get(repoId);
    },

    upsertRef(sessionId, { type, key = "", value, metadata = {} }) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO build_session_refs
           (build_session_id, ref_type, ref_key, ref_value, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(build_session_id, ref_type, ref_key, ref_value)
         DO UPDATE SET metadata = excluded.metadata, updated_at = excluded.updated_at`
      ).run(
        sessionId,
        type,
        key,
        String(value),
        JSON.stringify(metadata),
        now,
        now
      );
    },

    getRefs(sessionId, { type, key } = {}) {
      const clauses = ["build_session_id = ?"];
      const values = [sessionId];

      if (type) {
        clauses.push("ref_type = ?");
        values.push(type);
      }
      if (typeof key === "string") {
        clauses.push("ref_key = ?");
        values.push(key);
      }

      return db
        .prepare(
          `SELECT *
           FROM build_session_refs
           WHERE ${clauses.join(" AND ")}
           ORDER BY updated_at ASC, id ASC`
        )
        .all(...values)
        .map(parseRefRow);
    },

    findSessionByRef({ type, key, value }) {
      const clauses = ["ref_type = ?", "ref_value = ?"];
      const values = [type, String(value)];

      if (typeof key === "string") {
        clauses.push("ref_key = ?");
        values.push(key);
      }

      return db
        .prepare(
          `SELECT bs.*
           FROM build_session_refs refs
           JOIN build_sessions bs ON bs.id = refs.build_session_id
           WHERE ${clauses.join(" AND ")}
           ORDER BY refs.updated_at DESC, refs.id DESC
           LIMIT 1`
        )
        .get(...values);
    },

    recordWebhookDelivery({
      deliveryId,
      eventName,
      action = "",
      repositoryId = null,
      installationId = null,
      payload,
    }) {
      const now = new Date().toISOString();
      const result = db.prepare(
        `INSERT INTO github_webhook_events
           (delivery_id, event_name, action, repository_id, installation_id, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(delivery_id) DO NOTHING`
      ).run(
        deliveryId,
        eventName,
        action,
        repositoryId,
        installationId,
        JSON.stringify(payload),
        now
      );

      return result.changes > 0;
    },
  };
}

function parseEventRow(row) {
  return {
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  };
}

function parseRefRow(row) {
  return {
    ...row,
    metadata:
      typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
  };
}

module.exports = { createBuildSessionStore };
