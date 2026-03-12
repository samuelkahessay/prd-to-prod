function registerRunsRoutes(app, { eventStore }) {
  app.get("/api/runs", (_req, res) => {
    res.json({ runs: eventStore.listRuns() });
  });
}

module.exports = { registerRunsRoutes };
