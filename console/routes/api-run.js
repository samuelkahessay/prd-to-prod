const { isSupportedRunMode, normalizeRunMode } = require("../lib/run-mode");

function registerRunRoutes(app, { orchestrator, eventStore }) {
  app.post("/api/run", (req, res) => {
    const { inputSource, query, notes, mode, targetRepo, mockMode } = req.body || {};

    if (!inputSource || !mode) {
      res.status(400).json({ error: "inputSource and mode are required" });
      return;
    }

    if (inputSource === "workiq" && !query) {
      res.status(400).json({ error: "query is required for WorkIQ input" });
      return;
    }

    if (inputSource === "notes" && !notes) {
      res.status(400).json({ error: "notes are required for notes input" });
      return;
    }

    if (!isSupportedRunMode(mode)) {
      res.status(400).json({
        error: "mode must be one of auto, new, greenfield, or existing",
      });
      return;
    }

    const normalizedMode = normalizeRunMode(mode);

    if (normalizedMode === "existing" && !targetRepo) {
      res.status(400).json({ error: "targetRepo is required for existing mode" });
      return;
    }

    const run = orchestrator.startRun({
      inputSource,
      query,
      notes,
      mode: normalizedMode,
      displayMode: mode,
      targetRepo,
      mockMode: Boolean(mockMode),
      summary: query || (notes || "").slice(0, 140),
    });

    res.status(202).json({
      runId: run.id,
    });
  });

  app.get("/api/run/:id", (req, res) => {
    const run = eventStore.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    const { emitter, ...safeRun } = run;
    res.json(safeRun);
  });
}

module.exports = {
  registerRunRoutes,
};
