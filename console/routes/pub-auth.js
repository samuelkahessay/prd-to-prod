const crypto = require("crypto");
const {
  createUserSession,
  deleteActiveOAuthGrantsForUser,
  deleteUserSession,
  getActiveUserSession,
  purgeExpiredAuthState,
  replaceOAuthGrant,
} = require("../lib/auth-store");
const { encrypt } = require("../lib/crypto");

function isOAuthConfigured(clientId, clientSecret) {
  return Boolean(clientId && clientSecret);
}

function normalizeReturnTo(returnTo) {
  if (typeof returnTo !== "string") {
    return "/build";
  }
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/build";
  }
  return returnTo;
}

function registerPubAuthRoutes(app, { db }) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:3001";

  app.get("/pub/auth/github", (req, res) => {
    purgeExpiredAuthState(db);

    if (!isOAuthConfigured(clientId, clientSecret)) {
      return res.status(503).json({ error: "OAuth not configured" });
    }

    const state = crypto.randomUUID();
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    const returnTo = normalizeReturnTo(req.query.return_to);
    res.cookie("oauth_return_to", returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${frontendUrl}/pub/auth/github/callback`,
      scope: "repo read:user",
      state,
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  app.get("/pub/auth/github/callback", async (req, res) => {
    const { code, state } = req.query;
    const savedState = req.cookies?.oauth_state;
    purgeExpiredAuthState(db);

    res.clearCookie("oauth_state");
    const returnTo = normalizeReturnTo(req.cookies?.oauth_return_to);
    res.clearCookie("oauth_return_to");

    if (!code || !state || state !== savedState) {
      return res.redirect(`${frontendUrl}/build?error=oauth_state_mismatch`);
    }

    if (!isOAuthConfigured(clientId, clientSecret)) {
      return res.redirect(`${frontendUrl}/build?error=oauth_not_configured`);
    }

    try {
      // Exchange code for token
      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
          }),
        }
      );

      const tokenData = await tokenRes.json();
      if (tokenData.error || !tokenData.access_token) {
        return res.redirect(
          `${frontendUrl}/build?error=oauth_token_exchange`
        );
      }

      const accessToken = tokenData.access_token;

      // Fetch user profile
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        return res.redirect(`${frontendUrl}/build?error=github_user_fetch`);
      }

      const profile = await userRes.json();
      const now = new Date().toISOString();

      // Upsert user
      const existingUser = db
        .prepare("SELECT id FROM users WHERE github_id = ?")
        .get(profile.id);

      let userId;
      if (existingUser) {
        userId = existingUser.id;
        db.prepare(
          `UPDATE users SET github_login = ?, github_avatar_url = ?, updated_at = ?
           WHERE id = ?`
        ).run(profile.login, profile.avatar_url || "", now, userId);
      } else {
        userId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO users (id, github_id, github_login, github_avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(userId, profile.id, profile.login, profile.avatar_url || "", now, now);
      }

      // Create browser session (identity only)
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      const sessionId = createUserSession(db, {
        userId,
        createdAt: now,
        expiresAt,
      });

      // Store OAuth token as temporary grant (10-minute TTL)
      const grantExpires = new Date(
        Date.now() + 10 * 60 * 1000
      ).toISOString();

      replaceOAuthGrant(db, {
        userId,
        encryptedAccessToken: encrypt(accessToken),
        createdAt: now,
        expiresAt: grantExpires,
      });

      // Set session cookie
      res.cookie("build_session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.redirect(`${frontendUrl}${returnTo}`);
    } catch (err) {
      console.error("OAuth callback error:", err);
      res.redirect(`${frontendUrl}/build?error=oauth_internal`);
    }
  });

  app.post("/pub/auth/logout", (req, res) => {
    purgeExpiredAuthState(db);
    const sessionId = req.cookies?.build_session;
    if (sessionId) {
      const session = getActiveUserSession(db, sessionId);
      deleteUserSession(db, sessionId);
      if (session) {
        deleteActiveOAuthGrantsForUser(db, session.user_id);
      }
    }
    res.clearCookie("build_session");
    res.json({ ok: true });
  });

  app.get("/pub/auth/me", (req, res) => {
    purgeExpiredAuthState(db);
    const sessionId = req.cookies?.build_session;
    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = getActiveUserSession(db, sessionId);
    if (!session) {
      deleteUserSession(db, sessionId);
      res.clearCookie("build_session");
      return res.status(401).json({ error: "Session expired" });
    }

    res.json({
      id: session.user_id,
      githubId: session.github_id,
      githubLogin: session.github_login,
      githubAvatarUrl: session.github_avatar_url,
    });
  });
}

module.exports = { registerPubAuthRoutes };
