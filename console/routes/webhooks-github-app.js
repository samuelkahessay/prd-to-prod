const crypto = require("crypto");

function verifySignature(secret, payload, signature) {
  if (!secret || !Buffer.isBuffer(payload) || typeof signature !== "string") {
    return false;
  }
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function registerWebhookRoutes(app, { db }) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  app.post("/webhooks/github-app", (req, res) => {
    if (!secret) {
      return res.status(503).json({ error: "Webhook secret not configured" });
    }

    const signature = req.headers["x-hub-signature-256"];
    const rawBody = req.body; // Buffer from express.raw()

    if (!verifySignature(secret, rawBody, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const event = req.headers["x-github-event"];

    if (
      event === "installation_repositories" &&
      payload.action === "added"
    ) {
      const installationId = payload.installation?.id;
      const repos = payload.repositories_added || [];

      for (const repo of repos) {
        const repoId = repo.id;
        if (!repoId || !installationId) continue;

        // Match against build_sessions awaiting App install
        const session = db
          .prepare(
            `SELECT id FROM build_sessions
             WHERE github_repo_id = ? AND status = 'awaiting_install'
             ORDER BY created_at DESC LIMIT 1`
          )
          .get(repoId);

        if (session) {
          db.prepare(
            `UPDATE build_sessions
             SET app_installation_id = ?, status = 'provisioning', updated_at = ?
             WHERE id = ?`
          ).run(installationId, new Date().toISOString(), session.id);
        }
      }
    }

    if (event === "installation" && payload.action === "created") {
      const installationId = payload.installation?.id;
      const repos = payload.repositories || [];

      for (const repo of repos) {
        const repoId = repo.id;
        if (!repoId || !installationId) continue;

        const session = db
          .prepare(
            `SELECT id FROM build_sessions
             WHERE github_repo_id = ? AND status = 'awaiting_install'
             ORDER BY created_at DESC LIMIT 1`
          )
          .get(repoId);

        if (session) {
          db.prepare(
            `UPDATE build_sessions
             SET app_installation_id = ?, status = 'provisioning', updated_at = ?
             WHERE id = ?`
          ).run(installationId, new Date().toISOString(), session.id);
        }
      }
    }

    res.status(200).json({ ok: true });
  });
}

module.exports = { registerWebhookRoutes };
