const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

function createEventStore(db) {
  const emitters = new Map();

  function getEmitter(runId) {
    if (!emitters.has(runId)) {
      emitters.set(runId, new EventEmitter());
    }
    return emitters.get(runId);
  }

  return {
    createRun(run) {
      db.prepare(
        `INSERT INTO runs (id, created_at, updated_at, status, mode, input_source, target_repo, summary)
         VALUES (@id, @createdAt, @updatedAt, @status, @mode, @inputSource, @targetRepo, @summary)`
      ).run({
        id: run.id,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        status: run.status,
        mode: run.mode,
        inputSource: run.inputSource,
        targetRepo: run.targetRepo || "",
        summary: run.summary || "",
      });
      return this.getRun(run.id);
    },

    getRun(id) {
      const row = db
        .prepare("SELECT * FROM runs WHERE id = ?")
        .get(id);
      if (!row) return null;

      const events = db
        .prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY timestamp ASC")
        .all(id)
        .map((e) => ({
          id: e.id,
          stage: e.stage,
          type: e.type,
          kind: e.kind,
          data: JSON.parse(e.data),
          timestamp: e.timestamp,
        }));

      return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        mode: row.mode,
        inputSource: row.input_source,
        targetRepo: row.target_repo,
        summary: row.summary,
        events,
      };
    },

    listRuns() {
      return db
        .prepare("SELECT * FROM runs ORDER BY created_at DESC")
        .all()
        .map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          status: row.status,
          mode: row.mode,
          inputSource: row.input_source,
          targetRepo: row.target_repo,
          summary: row.summary,
        }));
    },

    appendEvent(runId, event) {
      const run = db.prepare("SELECT id FROM runs WHERE id = ?").get(runId);
      if (!run) return;

      db.prepare(
        `INSERT INTO run_events (id, run_id, timestamp, stage, type, kind, data)
         VALUES (@id, @runId, @timestamp, @stage, @type, @kind, @data)`
      ).run({
        id: event.id,
        runId,
        timestamp: event.timestamp,
        stage: event.stage,
        type: event.type || "system",
        kind: event.kind || event.type,
        data: JSON.stringify(event.data || {}),
      });

      db.prepare("UPDATE runs SET updated_at = ? WHERE id = ?").run(
        event.timestamp,
        runId
      );

      // If this is a blocked event, create a durable queue item
      if (event.type === "blocked" && event.data) {
        const queueId = require("crypto").randomUUID();
        db.prepare(
          `INSERT INTO queue_items (id, run_id, source_event_id, event, ref, reason, policy_rule, status, queued_at)
           VALUES (@id, @runId, @sourceEventId, @event, @ref, @reason, @policyRule, 'pending', @queuedAt)`
        ).run({
          id: queueId,
          runId,
          sourceEventId: event.id,
          event: event.data.event || "",
          ref: event.data.ref || "",
          reason: event.data.reason || "",
          policyRule: event.data.policyRule || "",
          queuedAt: event.timestamp,
        });
      }

      getEmitter(runId).emit("event", event);
    },

    subscribe(runId, listener) {
      const emitter = getEmitter(runId);
      emitter.on("event", listener);
      return () => emitter.off("event", listener);
    },

    updateRun(runId, patch) {
      const run = db.prepare("SELECT id FROM runs WHERE id = ?").get(runId);
      if (!run) return;

      if (patch.status) {
        db.prepare("UPDATE runs SET status = ? WHERE id = ?").run(
          patch.status,
          runId
        );
      }
      if (patch.updatedAt) {
        db.prepare("UPDATE runs SET updated_at = ? WHERE id = ?").run(
          patch.updatedAt,
          runId
        );
      }
    },

    // Queue operations
    listQueue() {
      return db
        .prepare(
          `SELECT qi.*, r.summary as run_summary
           FROM queue_items qi
           JOIN runs r ON r.id = qi.run_id
           WHERE qi.status = 'pending'
           ORDER BY qi.queued_at ASC`
        )
        .all()
        .map((row) => ({
          id: row.id,
          runId: row.run_id,
          event: row.event,
          ref: row.ref,
          reason: row.reason,
          policyRule: row.policy_rule,
          status: row.status,
          queuedAt: row.queued_at,
          resolvedAt: row.resolved_at,
          resolvedBy: row.resolved_by,
          resolution: row.resolution,
        }));
    },

    resolveQueueItem(queueId, { resolution, operatorId }) {
      const item = db
        .prepare("SELECT * FROM queue_items WHERE id = ?")
        .get(queueId);
      if (!item) return null;

      if (item.status !== "pending") {
        if (item.resolution === resolution) {
          return {
            id: item.id,
            runId: item.run_id,
            event: item.event,
            resolution: item.resolution,
            resolvedAt: item.resolved_at,
            resolvedBy: item.resolved_by,
          };
        }
        return { conflict: true, existingResolution: item.resolution };
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE queue_items SET status = 'resolved', resolution = ?, resolved_at = ?, resolved_by = ?
         WHERE id = ?`
      ).run(resolution, now, operatorId, queueId);

      // Emit a human event into run_events
      const eventId = require("crypto").randomUUID();
      this.appendEvent(item.run_id, {
        id: eventId,
        stage: "BUILD",
        type: "human",
        kind: "queue_resolved",
        data: {
          queueItemId: queueId,
          resolution,
          operatorId,
          event: item.event,
        },
        timestamp: now,
      });

      return {
        id: item.id,
        runId: item.run_id,
        event: item.event,
        resolution,
        resolvedAt: now,
        resolvedBy: operatorId,
      };
    },

    // Decision and audit queries
    getDecisions(runId) {
      return db
        .prepare(
          `SELECT * FROM run_events
           WHERE run_id = ? AND type IN ('blocked', 'human')
           ORDER BY timestamp ASC`
        )
        .all(runId)
        .map((e) => {
          const data = JSON.parse(e.data);
          return {
            timestamp: e.timestamp,
            type: e.type,
            event: data.event || e.kind,
            detail: data.reason || data.detail || "",
            policyRef: data.policyRule || null,
            resolvedBy: data.operatorId || null,
            resolvedAt: data.resolvedAt || null,
            resolution: data.resolution || null,
          };
        });
    },

    getAudit(runId) {
      return db
        .prepare(
          "SELECT * FROM run_events WHERE run_id = ? ORDER BY timestamp ASC"
        )
        .all(runId)
        .map((e) => {
          const data = JSON.parse(e.data);
          return {
            timestamp: e.timestamp,
            type: e.type,
            event: data.label || data.event || data.message || e.kind,
            detail: data.reason || data.detail || "",
            ref: data.ref || null,
          };
        });
    },
  };
}

function ensureDataDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const keepFile = path.join(dataDir, ".gitkeep");
  if (!fs.existsSync(keepFile)) {
    fs.writeFileSync(keepFile, "");
  }
}

module.exports = {
  createEventStore,
  ensureDataDir,
};
