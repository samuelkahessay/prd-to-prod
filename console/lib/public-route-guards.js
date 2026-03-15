const rateLimit = require("express-rate-limit");

function buildLimiter(config) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: config.message,
  });
}

function createPublicRouteGuards(overrides = {}) {
  const passthrough = (_req, _res, next) => next();
  const sessionCreate = overrides.sessionCreate || {};
  const sessionMessage = overrides.sessionMessage || {};
  const authStart = overrides.authStart || {};

  const sessionCreateLimiter = buildLimiter({
    windowMs: sessionCreate.windowMs || 60 * 60 * 1000,
    max: sessionCreate.max || 5,
    message: { error: "Too many sessions created. Try again later." },
  });

  const sessionMessageLimiter = buildLimiter({
    windowMs: sessionMessage.windowMs || 60 * 60 * 1000,
    max: sessionMessage.max || 100,
    message: { error: "Rate limit exceeded. Try again later." },
  });

  const authStartLimiter = buildLimiter({
    windowMs: authStart.windowMs || 60 * 60 * 1000,
    max: authStart.max || 10,
    message: { error: "Too many auth attempts. Try again later." },
  });

  return function registerPublicRouteGuards(app) {
    app.post("/pub/build-session", sessionCreateLimiter, passthrough);
    app.post(
      "/pub/build-session/:buildSessionId/message",
      sessionMessageLimiter,
      passthrough
    );
    app.get("/pub/auth/github", authStartLimiter, passthrough);
  };
}

module.exports = { createPublicRouteGuards };
