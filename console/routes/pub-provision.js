const { getActiveUserSession } = require("../lib/auth-store");

function registerProvisionRoutes(app, { db, provisioner, buildRunner }) {
  // Start provisioning — creates repo, checks App install
  app.post("/pub/build-session/:id/provision", async (req, res) => {
    const userSession = requireUserSession(db, req, res);
    if (!userSession) {
      return;
    }

    const session = getOwnedBuildSession(db, req.params.id, userSession.user_id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }

    try {
      const result = await provisioner.provisionRepo(session.id);
      res.json(result);
    } catch (err) {
      console.error("Provisioning error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Resume after App install — creates PRD issue + dispatches build
  app.post("/pub/build-session/:id/start-build", async (req, res) => {
    const userSession = requireUserSession(db, req, res);
    if (!userSession) {
      return;
    }

    const session = getOwnedBuildSession(db, req.params.id, userSession.user_id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }

    if (session.status === "ready") {
      return res.status(400).json({
        error: "Repository provisioning has not started yet.",
      });
    }

    if (!session.app_installation_id) {
      return res.status(400).json({
        error: "GitHub App not installed yet. Install the app first.",
      });
    }

    if (!isStartableStatus(session.status)) {
      return res.status(400).json({
        error: `Build session is not startable from status ${session.status}.`,
      });
    }

    try {
      await provisioner.createPrdIssue(
        session.id,
        session.app_installation_id
      );

      // Dispatch builder
      await buildRunner.dispatchBuild(session.id);
      res.json({ sessionId: session.id, status: "building" });
    } catch (err) {
      console.error("Build dispatch error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}

function requireUserSession(db, req, res) {
  const sessionId = req.cookies?.build_session;
  if (!sessionId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const userSession = getActiveUserSession(db, sessionId);
  if (!userSession) {
    res.status(401).json({ error: "Session expired" });
    return null;
  }

  return userSession;
}

function getOwnedBuildSession(db, buildSessionId, userId) {
  const session = db
    .prepare("SELECT * FROM build_sessions WHERE id = ?")
    .get(buildSessionId);

  if (!session || session.user_id !== userId) {
    return null;
  }

  return session;
}

function isStartableStatus(status) {
  return status === "provisioning";
}

module.exports = { registerProvisionRoutes };
