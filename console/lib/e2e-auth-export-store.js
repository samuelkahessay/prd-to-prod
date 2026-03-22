function createE2EAuthExportStore(db) {
  function createExport({ id, cookieHeader, user, createdAt, expiresAt }) {
    db.prepare(
      `INSERT INTO e2e_auth_exports (id, cookie_header, user_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, cookieHeader, JSON.stringify(user || {}), createdAt, expiresAt);
    return getExport(id);
  }

  function getExport(id) {
    const row = db
      .prepare(
        `SELECT id, cookie_header, user_json, created_at, expires_at, consumed_at
         FROM e2e_auth_exports
         WHERE id = ?`
      )
      .get(id);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      cookieHeader: row.cookie_header,
      user: parseJson(row.user_json),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at || null,
    };
  }

  function consumeExport(id, now = new Date().toISOString()) {
    const row = db
      .prepare(
        `SELECT id, cookie_header, user_json, created_at, expires_at, consumed_at
         FROM e2e_auth_exports
         WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`
      )
      .get(id, now);
    if (!row) {
      return null;
    }

    db.prepare("UPDATE e2e_auth_exports SET consumed_at = ? WHERE id = ?").run(now, id);
    return {
      id: row.id,
      cookieHeader: row.cookie_header,
      user: parseJson(row.user_json),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      consumedAt: now,
    };
  }

  function purgeExpired(now = new Date().toISOString()) {
    return db
      .prepare("DELETE FROM e2e_auth_exports WHERE consumed_at IS NOT NULL OR expires_at <= ?")
      .run(now).changes;
  }

  return {
    createExport,
    getExport,
    consumeExport,
    purgeExpired,
  };
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

module.exports = {
  createE2EAuthExportStore,
};
