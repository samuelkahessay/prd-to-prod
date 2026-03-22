const { getActiveUserSession } = require("../lib/auth-store");
const { validateSessionGithubAccess } = require("../lib/github-session-auth");
const { createE2EAuthExportStore } = require("../lib/e2e-auth-export-store");

function registerE2EAuthRoutes(app, {
  harness,
  db,
  validateSessionAccess = validateSessionGithubAccess,
}) {
  const exportStore = createE2EAuthExportStore(db);

  app.post("/pub/e2e/auth-cookie", async (req, res) => {
    const sessionId = req.cookies?.build_session;
    if (!sessionId) {
      return res.status(401).json({ error: "Build-session authentication required" });
    }

    const session = getActiveUserSession(db, sessionId);
    if (!session) {
      return res.status(401).json({ error: "Build-session authentication expired" });
    }

    try {
      await validateSessionAccess(session, {
        returnTo: req.body?.returnTo || "/build",
      });
      const user = {
        id: session.user_id,
        githubId: session.github_id,
        githubLogin: session.github_login,
        githubAvatarUrl: session.github_avatar_url,
      };
      const exportRequestId =
        typeof req.body?.exportRequestId === "string" ? req.body.exportRequestId.trim() : "";
      let result;
      if (exportRequestId) {
        exportStore.purgeExpired();
        const now = new Date();
        exportStore.createExport({
          id: exportRequestId,
          cookieHeader: `build_session=${sessionId}`,
          user,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
        });
        result = {
          cookieJarPath: req.body?.path,
          mode: "handoff",
        };
      } else {
        result = {
          ...harness.exportAuthCookie({
            cookieJarPath: req.body?.path,
            cookieHeader: `build_session=${sessionId}`,
            user,
          }),
          mode: "server_write",
        };
      }

      res.json({
        ok: true,
        cookieJarPath: result.cookieJarPath,
        authBootstrapUrl: harness.authBootstrapUrl(result.cookieJarPath),
        mode: result.mode,
      });
    } catch (error) {
      if (error?.status === 409) {
        return res.status(409).json({
          error: error.code,
          message: error.message,
          action: error.action,
          returnTo: error.returnTo,
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/pub/e2e/auth-cookie", async (req, res) => {
    try {
      const result = await harness.validateAuth(req.query.path);
      res.json({
        ok: true,
        cookieJarPath: result.cookieJarPath,
        user: result.user,
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  app.get("/pub/e2e/auth-cookie/export/:id", async (req, res) => {
    exportStore.purgeExpired();
    const record = exportStore.consumeExport(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Auth export request not ready" });
    }
    res.json({
      ok: true,
      cookieHeader: record.cookieHeader,
      user: record.user,
    });
  });
}

module.exports = {
  registerE2EAuthRoutes,
};
