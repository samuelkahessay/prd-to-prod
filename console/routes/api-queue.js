function registerQueueRoutes(app, { eventStore }) {
  app.get("/api/queue", (_req, res) => {
    res.json(eventStore.listQueue());
  });

  app.post("/api/queue/:id/resolve", (req, res) => {
    const { resolution } = req.body || {};
    if (!resolution || !["approved", "rejected"].includes(resolution)) {
      res.status(400).json({ error: "resolution must be 'approved' or 'rejected'" });
      return;
    }

    const operatorId = req.operatorId || "anonymous";

    const result = eventStore.resolveQueueItem(req.params.id, {
      resolution,
      operatorId,
    });

    if (!result) {
      res.status(404).json({ error: "Queue item not found" });
      return;
    }

    if (result.conflict) {
      res.status(409).json({
        error: "Queue item already resolved",
        existingResolution: result.existingResolution,
      });
      return;
    }

    res.json(result);
  });
}

module.exports = { registerQueueRoutes };
