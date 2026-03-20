const crypto = require("crypto");

function hashCode(code) {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function generateCode() {
  const bytes = crypto.randomBytes(6);
  const raw = bytes.toString("base64url").slice(0, 8).toUpperCase();
  return `BETA-${raw}`;
}

function createAccessCodeStore(db) {
  return {
    generate({ count = 1, issuer = "system", expiresAt = null, paymentRef = null, memo = null } = {}) {
      const codes = [];
      const now = new Date().toISOString();
      const insert = db.prepare(
        `INSERT INTO access_codes (code_hash, created_at, expires_at, issuer, payment_ref, memo)
         VALUES (?, ?, ?, ?, ?, ?)`
      );

      const runBatch = db.transaction(() => {
        for (let i = 0; i < count; i++) {
          const code = generateCode();
          const hash = hashCode(code);
          insert.run(hash, now, expiresAt, issuer, paymentRef, memo);
          codes.push(code);
        }
      });

      runBatch();
      return codes;
    },

    redeem(code, userId, buildSessionId) {
      const hash = hashCode(code);
      const now = new Date().toISOString();

      const result = db.prepare(
        `UPDATE access_codes
         SET redeemed_by = ?, redeemed_at = ?, build_session_id = ?
         WHERE code_hash = ?
           AND redeemed_by IS NULL
           AND (expires_at IS NULL OR expires_at > ?)`
      ).run(userId, now, buildSessionId, hash, now);

      if (result.changes === 0) {
        const existing = db.prepare("SELECT * FROM access_codes WHERE code_hash = ?").get(hash);
        if (!existing) return { success: false, reason: "invalid_code" };
        if (existing.redeemed_by) return { success: false, reason: "already_redeemed" };
        if (existing.expires_at && existing.expires_at <= now) return { success: false, reason: "expired" };
        return { success: false, reason: "unknown" };
      }

      return { success: true };
    },

    hasCredit(userId) {
      const row = db.prepare(
        `SELECT 1 FROM access_codes
         WHERE redeemed_by = ? AND build_session_id IS NULL`
      ).get(userId);
      return !!row;
    },

    consumeCredit(userId, buildSessionId) {
      const now = new Date().toISOString();
      const result = db.prepare(
        `UPDATE access_codes
         SET build_session_id = ?
         WHERE code_hash = (
           SELECT code_hash FROM access_codes
           WHERE redeemed_by = ? AND build_session_id IS NULL
           LIMIT 1
         )`
      ).run(buildSessionId, userId);
      return result.changes > 0;
    },

    hasActiveCredit(userId, buildSessionId) {
      const row = db.prepare(
        `SELECT 1 FROM access_codes
         WHERE redeemed_by = ? AND (build_session_id IS NULL OR build_session_id = ?)`
      ).get(userId, buildSessionId);
      return !!row;
    },

    list({ unused = false, limit = 50 } = {}) {
      if (unused) {
        return db.prepare(
          `SELECT code_hash, created_at, expires_at, issuer, payment_ref, memo
           FROM access_codes WHERE redeemed_by IS NULL
           ORDER BY created_at DESC LIMIT ?`
        ).all(limit);
      }
      return db.prepare(
        `SELECT code_hash, created_at, expires_at, issuer, payment_ref, memo,
                redeemed_by, redeemed_at, build_session_id
         FROM access_codes ORDER BY created_at DESC LIMIT ?`
      ).all(limit);
    },
  };
}

module.exports = { createAccessCodeStore, hashCode, generateCode };
