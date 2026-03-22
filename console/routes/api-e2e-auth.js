const { getActiveUserSession } = require("../lib/auth-store");

function registerE2EAuthRoutes(app, { harness, db }) {
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
      const result = harness.exportAuthCookie({
        cookieJarPath: req.body?.path,
        cookieHeader: `build_session=${sessionId}`,
        user: {
          id: session.user_id,
          githubId: session.github_id,
          githubLogin: session.github_login,
          githubAvatarUrl: session.github_avatar_url,
        },
      });

      res.json({
        ok: true,
        cookieJarPath: result.cookieJarPath,
        authBootstrapUrl: harness.authBootstrapUrl(result.cookieJarPath),
      });
    } catch (error) {
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
}

module.exports = {
  registerE2EAuthRoutes,
};
