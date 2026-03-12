function registerRunAuditRoutes(app, { eventStore }) {
  app.get("/api/run/:id/audit", (req, res) => {
    const run = eventStore.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(eventStore.getAudit(req.params.id));
  });
}

module.exports = { registerRunAuditRoutes };
