const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const { createDatabase } = require("./lib/db");
const { createEventStore } = require("./lib/event-store");
const { createOrchestrator } = require("./lib/orchestrator");
const { runPreflight } = require("./lib/preflight");
const { registerPreflightRoutes } = require("./routes/api-preflight");
const { registerRunRoutes } = require("./routes/api-run");
const { registerRunStreamRoutes } = require("./routes/api-run-stream");
const { registerRunsRoutes } = require("./routes/api-runs");
const { registerQueueRoutes } = require("./routes/api-queue");
const { registerRunDecisionRoutes } = require("./routes/api-run-decisions");
const { registerRunAuditRoutes } = require("./routes/api-run-audit");

const app = express();
const port = Number(process.env.CONSOLE_PORT || 3000);
app.locals.projectRoot = path.resolve(__dirname, "..");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Auth enforcement boundary — all /api/* require operator session
// Full auth (provider, session storage, token rotation) deferred to follow-up spec
// For now: check for operator cookie, set req.operatorId
app.use("/api", (req, res, next) => {
  const operatorId = req.cookies?.operatorId;
  if (!operatorId) {
    // In development, allow unauthenticated access
    if (process.env.NODE_ENV !== "production") {
      req.operatorId = "dev-operator";
      return next();
    }
    return res.status(401).json({ error: "Authentication required" });
  }
  req.operatorId = operatorId;
  next();
});

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const db = createDatabase(dataDir);
const eventStore = createEventStore(db);
const orchestrator = createOrchestrator({
  projectRoot: path.resolve(__dirname, ".."),
  dataDir: path.join(__dirname, "data"),
  eventStore,
});

registerPreflightRoutes(app, { runPreflight });
registerRunRoutes(app, { orchestrator, eventStore });
registerRunStreamRoutes(app, { eventStore });
registerRunsRoutes(app, { eventStore });
registerQueueRoutes(app, { eventStore });
registerRunDecisionRoutes(app, { eventStore });
registerRunAuditRoutes(app, { eventStore });

// Health check for Fly.io / load balancers
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`Operator console listening on http://${host}:${port}`);
});
