const { getActiveUserSession } = require("../lib/auth-store");

function registerProvisionRoutes(app, { db, serviceResolver }) {
  // Start provisioning — creates repo, waits for app installation, bootstraps target repo
  app.post("/pub/build-session/:id/provision", async (req, res) => {
    const userSession = requireUserSession(db, req, res);
    if (!userSession) {
      return;
    }

    const session = getOwnedBuildSession(db, req.params.id, userSession.user_id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }

    if (!enforceSessionBoundary(db, userSession.user_id, session, res)) {
      return;
    }

    try {
      const { provisioner } = serviceResolver.forSession(session.id);
      const result = await provisioner.provisionRepo(session.id);
      res.json(result);
    } catch (err) {
      console.error("Provisioning error:", err);
      if (err.message.includes("OAuth grant") || err.message.includes("re-authenticate")) {
        return res.status(401).json({
          error: "oauth_grant_expired",
          message: "Your GitHub authorization has expired. Please re-authenticate.",
          action: "re_auth",
          returnTo: `/build/${session.id}`,
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Launch the target-repo pipeline after bootstrap is complete
  app.post("/pub/build-session/:id/start-build", async (req, res) => {
    const userSession = requireUserSession(db, req, res);
    if (!userSession) {
      return;
    }

    const session = getOwnedBuildSession(db, req.params.id, userSession.user_id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }

    if (!enforceSessionBoundary(db, userSession.user_id, session, res)) {
      return;
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
      const { provisioner, buildRunner } = serviceResolver.forSession(session.id);
      if (session.is_demo) {
        await buildRunner.dispatchBuild(session.id);
      } else {
        const result = await provisioner.launchPipeline(session.id);
        return res.json(result);
      }

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
  return status === "ready_to_launch" || status === "awaiting_capacity" || status === "stalled";
}

function enforceSessionBoundary(db, userId, session, res) {
  const user = db.prepare("SELECT github_id FROM users WHERE id = ?").get(userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return false;
  }
  if (session.is_demo && user.github_id !== 0) {
    res.status(403).json({ error: "Demo sessions require demo authentication" });
    return false;
  }
  if (!session.is_demo && user.github_id === 0) {
    res.status(403).json({ error: "Real sessions require GitHub authentication" });
    return false;
  }
  return true;
}

module.exports = { registerProvisionRoutes, enforceSessionBoundary };
