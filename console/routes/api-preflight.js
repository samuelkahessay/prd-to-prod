function registerPreflightRoutes(app, { runPreflight }) {
  app.get("/api/preflight", (req, res) => {
    const checks = runPreflight(req.app.locals?.projectRoot || process.cwd());
    res.json({ checks });
  });
}

module.exports = {
  registerPreflightRoutes,
};
