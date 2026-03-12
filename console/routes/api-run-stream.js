function registerRunStreamRoutes(app, { eventStore }) {
  app.get("/api/run/:id/stream", (req, res) => {
    const run = eventStore.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    for (const event of run.events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const unsubscribe = eventStore.subscribe(req.params.id, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on("close", () => {
      if (unsubscribe) {
        unsubscribe();
      }
      res.end();
    });
  });
}

module.exports = {
  registerRunStreamRoutes,
};
