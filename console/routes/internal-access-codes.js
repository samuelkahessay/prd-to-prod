const { createAccessCodeStore } = require("../lib/access-codes");

function registerInternalAccessCodeRoutes(app, { db }) {
  const accessCodes = createAccessCodeStore(db);

  app.post("/internal/access-codes/generate", (req, res) => {
    const { count = 1, issuer = "internal", expiresAt = null, paymentRef = null, memo = null } = req.body || {};
    const codes = accessCodes.generate({
      count: Math.min(Math.max(1, Number(count) || 1), 50),
      issuer,
      expiresAt,
      paymentRef,
      memo,
    });
    res.json({ codes });
  });
}

module.exports = { registerInternalAccessCodeRoutes };
