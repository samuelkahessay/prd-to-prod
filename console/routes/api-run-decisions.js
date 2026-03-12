function registerRunDecisionRoutes(app, { eventStore }) {
  app.get("/api/run/:id/decisions", (req, res) => {
    const run = eventStore.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(eventStore.getDecisions(req.params.id));
  });
}

module.exports = { registerRunDecisionRoutes };
