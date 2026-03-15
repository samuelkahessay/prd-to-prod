function registerInternalBuildRoutes(app, { buildSessionStore }) {
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
  app.post("/internal/build-callback", (req, res) => {
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

    // Update session status on terminal events
    if (category === "delivery" && kind === "complete") {
      const deployUrl = data?.deploy_url;
      buildSessionStore.updateSession(session_id, {
        status: "complete",
        ...(deployUrl ? { deploy_url: deployUrl } : {}),
      });
    }

    if (category === "build" && kind === "agent_error") {
      buildSessionStore.updateSession(session_id, { status: "failed" });
    }

    res.json({ ok: true, eventId: event.id });
  });
}

function baseUrl() {
  return process.env.BUILD_API_BASE_URL || "https://prd-to-prod.fly.dev";
}

module.exports = { registerInternalBuildRoutes };
