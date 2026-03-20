const { createAccessCodeStore } = require("../lib/access-codes");

function registerAccessCodeRoutes(app, { db }) {
  const accessCodes = createAccessCodeStore(db);

  app.post("/api/access-codes/generate", (req, res) => {
    const { count = 1, issuer, expiresAt, paymentRef, memo } = req.body || {};
    const codes = accessCodes.generate({
      count: Math.min(Math.max(1, Number(count) || 1), 50),
      issuer: issuer || req.cookies?.operatorId || "operator",
      expiresAt: expiresAt || null,
      paymentRef: paymentRef || null,
      memo: memo || null,
    });
    res.json({ codes });
  });

  app.get("/api/access-codes", (req, res) => {
    const unused = req.query.unused === "true";
    const codes = accessCodes.list({ unused });
    res.json({ codes });
  });
}

module.exports = { registerAccessCodeRoutes };
