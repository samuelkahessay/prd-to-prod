const { getActiveUserSession } = require("../lib/auth-store");
const { encrypt } = require("../lib/crypto");

const BYOK_CREDENTIALS = [
  { key: "COPILOT_GITHUB_TOKEN", required: true },
  { key: "VERCEL_TOKEN", required: false },
  { key: "VERCEL_ORG_ID", required: false },
  { key: "VERCEL_PROJECT_ID", required: false },
];

function registerProvisionRoutes(app, { db, serviceResolver }) {
  // Store BYOK credentials for a build session
  app.post("/pub/build-session/:id/credentials", (req, res) => {
    const userSession = requireUserSession(db, req, res);
    if (!userSession) return;

    const session = getOwnedBuildSession(db, req.params.id, userSession.user_id);
    if (!session) {
      return res.status(404).json({ error: "Build session not found" });
    }

    if (!enforceSessionBoundary(db, userSession.user_id, session, res)) return;

    if (session.is_demo) {
      return res.status(400).json({ error: "Demo sessions do not accept credentials" });
    }

    const credentials = req.body;
    if (!credentials || typeof credentials !== "object") {
      return res.status(400).json({ error: "Credentials object required" });
    }

    if (!credentials.COPILOT_GITHUB_TOKEN || typeof credentials.COPILOT_GITHUB_TOKEN !== "string") {
      return res.status(400).json({ error: "COPILOT_GITHUB_TOKEN is required" });
    }

    const { createBuildSessionStore } = require("../lib/build-session-store");
    const buildSessionStore = createBuildSessionStore(db);

    for (const { key } of BYOK_CREDENTIALS) {
      const value = credentials[key];
      if (typeof value === "string" && value.length > 0) {
        buildSessionStore.upsertRef(session.id, {
          type: "credential",
          key,
          value: encrypt(value),
        });
      }
    }

    res.json({ stored: true });
  });
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

    // Real sessions require BYOK Copilot token before launch
    if (!session.is_demo) {
      const copilotRef = db
        .prepare(
          `SELECT 1 FROM build_session_refs
           WHERE build_session_id = ? AND ref_type = 'credential' AND ref_key = 'COPILOT_GITHUB_TOKEN'`
        )
        .get(session.id);
      if (!copilotRef) {
        return res.status(400).json({
          error: "credentials_required",
          message: "Submit your Copilot token before starting the build.",
          action: "byok",
        });
      }
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
