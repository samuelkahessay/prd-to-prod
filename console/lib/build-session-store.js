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
    createSession(userId) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO build_sessions (id, user_id, status, created_at, updated_at)
         VALUES (?, ?, 'refining', ?, ?)`
      ).run(id, userId || null, now, now);
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
  };
}

function parseEventRow(row) {
  return {
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  };
}

module.exports = { createBuildSessionStore };
