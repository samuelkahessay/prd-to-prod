const crypto = require("crypto");

function purgeExpiredAuthState(db, now = new Date().toISOString()) {
  const runCleanup = db.transaction((timestamp) => {
    const expiredSessions = db
      .prepare("DELETE FROM user_sessions WHERE expires_at <= ?")
      .run(timestamp).changes;
    const staleGrants = db
      .prepare(
        `DELETE FROM oauth_grants
         WHERE consumed_at IS NOT NULL OR expires_at <= ?`
      )
      .run(timestamp).changes;

    return {
      expiredSessions,
      staleGrants,
    };
  });

  return runCleanup(now);
}

function createUserSession(db, { userId, createdAt, expiresAt, sessionId = crypto.randomUUID() }) {
  db.prepare(
    `INSERT INTO user_sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(sessionId, userId, createdAt, expiresAt);

  return sessionId;
}

function replaceOAuthGrant(db, {
  userId,
  encryptedAccessToken,
  createdAt,
  expiresAt,
  grantId = crypto.randomUUID(),
}) {
  const runReplace = db.transaction((params) => {
    db.prepare("DELETE FROM oauth_grants WHERE user_id = ?").run(params.userId);
    db.prepare(
      `INSERT INTO oauth_grants (id, user_id, github_access_token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      params.grantId,
      params.userId,
      params.encryptedAccessToken,
      params.createdAt,
      params.expiresAt
    );
  });

  runReplace({
    grantId,
    userId,
    encryptedAccessToken,
    createdAt,
    expiresAt,
  });

  return grantId;
}

function deleteUserSession(db, sessionId) {
  return db.prepare("DELETE FROM user_sessions WHERE id = ?").run(sessionId).changes;
}

function deleteActiveOAuthGrantsForUser(db, userId) {
  return db
    .prepare(
      `DELETE FROM oauth_grants
       WHERE user_id = ? AND consumed_at IS NULL`
    )
    .run(userId).changes;
}

function getActiveUserSession(db, sessionId, now = new Date().toISOString()) {
  return db
    .prepare(
      `SELECT us.user_id, us.expires_at, u.github_id, u.github_login, u.github_avatar_url
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       WHERE us.id = ? AND us.expires_at > ?`
    )
    .get(sessionId, now);
}

function startAuthStateCleanup(db, {
  intervalMs = 5 * 60 * 1000,
  logger = console,
} = {}) {
  const runCleanup = () => {
    try {
      purgeExpiredAuthState(db);
    } catch (error) {
      logger.error("Auth state cleanup failed:", error);
    }
  };

  runCleanup();
  const timer = setInterval(runCleanup, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

module.exports = {
  createUserSession,
  deleteActiveOAuthGrantsForUser,
  deleteUserSession,
  getActiveUserSession,
  purgeExpiredAuthState,
  replaceOAuthGrant,
  startAuthStateCleanup,
};
