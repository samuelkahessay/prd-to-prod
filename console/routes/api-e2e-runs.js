const fs = require("fs");

function registerE2ERunRoutes(app, { harness }) {
  app.post("/api/e2e/runs", async (req, res) => {
    const { lane, keepRepo = true, cookieJarPath = "", requestedBy = "" } = req.body || {};
    if (!lane) {
      return res.status(400).json({ error: "lane is required" });
    }

    if (!harness.isDashboardLaunchable(lane)) {
      return res.status(400).json({
        error: "Lane must be one of provision-only, decomposer-only, first-pr, demo-browser-canary, or full-ladder.",
      });
    }

    try {
      const run = await harness.launchRun({
        lane,
        keepRepo: Boolean(keepRepo),
        cookieJarPath,
        requestedBy: requestedBy || req.operatorId || "operator",
      });
      res.status(202).json({ runId: run.id, run });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/e2e/runs", (_req, res) => {
    res.json({ runs: harness.listRuns() });
  });

  app.get("/api/e2e/runs/:id", (req, res) => {
    const run = harness.getRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    res.json(run);
  });

  app.post("/api/e2e/runs/:id/cleanup", async (req, res) => {
    try {
      const run = await harness.cleanupRun(req.params.id, {
        force: req.body?.force === true,
      });
      res.json({ run });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/e2e/runs/:id/report", async (req, res) => {
    const run = harness.getRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }

    const reportJsonPath = run.reportJsonPath;
    const reportMarkdownPath = run.reportMarkdownPath;

    res.json({
      reportJsonPath,
      reportMarkdownPath,
      reportJson:
        reportJsonPath && fs.existsSync(reportJsonPath)
          ? JSON.parse(fs.readFileSync(reportJsonPath, "utf8"))
          : null,
      reportMarkdown:
        reportMarkdownPath && fs.existsSync(reportMarkdownPath)
          ? fs.readFileSync(reportMarkdownPath, "utf8")
          : null,
    });
  });
}

module.exports = {
  registerE2ERunRoutes,
};
