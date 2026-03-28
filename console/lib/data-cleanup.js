/**
 * Periodic cleanup of transient data that accumulates over time.
 *
 * Targets:
 * - github_webhook_events: full payloads, ~20KB each, grow fastest
 * - build_events + build_session_refs for completed/demo sessions older than retention
 * - build_sessions themselves once all related data is purged
 */

const DEFAULT_WEBHOOK_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day
const DEFAULT_BUILD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function purgeStaleData(db, {
  webhookMaxAgeMs = DEFAULT_WEBHOOK_MAX_AGE_MS,
  buildMaxAgeMs = DEFAULT_BUILD_MAX_AGE_MS,
} = {}) {
  const now = Date.now();
  const webhookCutoff = new Date(now - webhookMaxAgeMs).toISOString();
  const buildCutoff = new Date(now - buildMaxAgeMs).toISOString();

  const cleanup = db.transaction(() => {
    // 1. Webhook events older than 24h
    const webhooks = db.prepare(
      "DELETE FROM github_webhook_events WHERE created_at < ?"
    ).run(webhookCutoff).changes;

    // 2. Build data from completed/demo sessions older than 7 days
    const oldSessionIds = db.prepare(
      `SELECT id FROM build_sessions
       WHERE (status = 'complete' OR is_demo = 1) AND created_at < ?`
    ).all(buildCutoff).map((r) => r.id);

    let buildEvents = 0;
    let buildRefs = 0;
    let buildSessions = 0;
    for (const id of oldSessionIds) {
      buildEvents += db.prepare(
        "DELETE FROM build_events WHERE build_session_id = ?"
      ).run(id).changes;
      buildRefs += db.prepare(
        "DELETE FROM build_session_refs WHERE build_session_id = ?"
      ).run(id).changes;
      buildSessions += db.prepare(
        "DELETE FROM build_sessions WHERE id = ?"
      ).run(id).changes;
    }

    return { webhooks, buildEvents, buildRefs, buildSessions };
  });

  return cleanup();
}

function startDataCleanup(db, {
  intervalMs = DEFAULT_INTERVAL_MS,
  webhookMaxAgeMs = DEFAULT_WEBHOOK_MAX_AGE_MS,
  buildMaxAgeMs = DEFAULT_BUILD_MAX_AGE_MS,
  logger = console,
} = {}) {
  const runCleanup = () => {
    try {
      const result = purgeStaleData(db, { webhookMaxAgeMs, buildMaxAgeMs });
      const total = result.webhooks + result.buildEvents + result.buildRefs + result.buildSessions;
      if (total > 0) {
        logger.log(
          `Data cleanup: ${result.webhooks} webhooks, ${result.buildEvents} build events, ` +
          `${result.buildRefs} refs, ${result.buildSessions} sessions purged`
        );
      }
    } catch (error) {
      logger.error("Data cleanup failed:", error);
    }
  };

  runCleanup();
  const timer = setInterval(runCleanup, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

module.exports = { purgeStaleData, startDataCleanup };
