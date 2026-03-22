const { deactivatePipeline } = require("../lib/pipeline-lifecycle");

function registerInternalBuildRoutes(app, { buildSessionStore, serviceResolver }) {
  // Builder agent fetches bootstrap data at runtime
  app.get("/internal/build-bootstrap/:id", (req, res) => {
    const session = buildSessionStore.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }
    if (!session.prd_final) {
      return res.status(400).json({ error: "Session has no finalized PRD" });
    }

    res.json({
      build_session_id: session.id,
      target_repo: session.github_repo,
      github_repo_id: session.github_repo_id,
      prd_final: session.prd_final,
      callback_url: `${baseUrl()}/internal/build-callback`,
    });
  });

  // Builder agent reports progress events
  app.post("/internal/build-callback", async (req, res) => {
    const { session_id, category, kind, data } = req.body;

    if (!session_id || !category || !kind) {
      return res.status(400).json({
        error: "session_id, category, and kind are required",
      });
    }

    const session = buildSessionStore.getSession(session_id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }

    const event = buildSessionStore.appendEvent(session_id, {
      category,
      kind,
      data: data || {},
    });

    if (session.status === "complete" && kind !== "complete") {
      return res.json({ ok: true, eventId: event.id });
    }

    if (
      session.status === "handoff_ready" &&
      kind !== "complete" &&
      kind !== "handoff_ready"
    ) {
      return res.json({ ok: true, eventId: event.id });
    }

    let reachedTerminalState = false;

    // Update session status on terminal events
    if (category === "delivery" && kind === "complete") {
      const deployUrl = data?.deploy_url;
      buildSessionStore.updateSession(session_id, {
        status: "complete",
        ...(deployUrl ? { deploy_url: deployUrl } : {}),
      });
      reachedTerminalState = true;
    }

    if (
      category === "delivery" &&
      kind === "handoff_ready" &&
      session.status !== "complete"
    ) {
      buildSessionStore.updateSession(session_id, {
        status: "handoff_ready",
      });
      reachedTerminalState = true;
    }

    if (category === "build" && kind === "agent_error") {
      buildSessionStore.updateSession(session_id, { status: "stalled" });
    }

    if (reachedTerminalState) {
      await deactivatePipeline(
        serviceResolver,
        buildSessionStore.getSession(session_id) || session
      );
    }

    res.json({ ok: true, eventId: event.id });
  });

  app.post("/internal/build-release", async (req, res) => {
    const { session_id, detail } = req.body || {};
    if (!session_id) {
      return res.status(400).json({ error: "session_id is required" });
    }

    const session = buildSessionStore.getSession(session_id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }

    const releasable = new Set(["ready_to_launch", "awaiting_capacity", "building"]);
    if (!releasable.has(session.status)) {
      return res.json({
        ok: true,
        released: false,
        status: session.status,
      });
    }

    buildSessionStore.updateSession(session_id, { status: "stalled" });
    buildSessionStore.appendEvent(session_id, {
      category: "build",
      kind: "capacity_released",
      data: {
        detail: detail || "Released build capacity for E2E cleanup.",
      },
    });

    await deactivatePipeline(
      serviceResolver,
      buildSessionStore.getSession(session_id) || session
    );

    return res.json({
      ok: true,
      released: true,
      status: "stalled",
    });
  });
}

function baseUrl() {
  return process.env.BUILD_API_BASE_URL || "https://prd-to-prod.fly.dev";
}

module.exports = { registerInternalBuildRoutes };
