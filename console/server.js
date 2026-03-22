const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const { createDatabase } = require("./lib/db");
const { startAuthStateCleanup } = require("./lib/auth-store");
const { createEventStore } = require("./lib/event-store");
const { createOrchestrator } = require("./lib/orchestrator");
const { createPublicRouteGuards } = require("./lib/public-route-guards");
const { runPreflight } = require("./lib/preflight");
const { registerPreflightRoutes } = require("./routes/api-preflight");
const { registerRunRoutes } = require("./routes/api-run");
const { registerRunStreamRoutes } = require("./routes/api-run-stream");
const { registerRunsRoutes } = require("./routes/api-runs");
const { registerQueueRoutes } = require("./routes/api-queue");
const { registerRunDecisionRoutes } = require("./routes/api-run-decisions");
const { registerRunAuditRoutes } = require("./routes/api-run-audit");
const { registerAccessCodeRoutes } = require("./routes/api-access-codes");
const { registerWebhookRoutes } = require("./routes/webhooks-github-app");
const { registerPubAuthRoutes } = require("./routes/pub-auth");
const { registerBuildSessionRoutes } = require("./routes/pub-build-session");
const { registerBuildStreamRoutes } = require("./routes/pub-build-stream");
const { createBuildSessionStore } = require("./lib/build-session-store");
const { createServiceResolver } = require("./lib/service-resolver");
const { registerProvisionRoutes } = require("./routes/pub-provision");
const { registerInternalBuildRoutes } = require("./routes/internal-build");
const { registerInternalAccessCodeRoutes } = require("./routes/internal-access-codes");
const { createE2EHarness } = require("./lib/e2e/harness");
const { registerE2ERunRoutes } = require("./routes/api-e2e-runs");
const { registerE2EStreamRoutes } = require("./routes/api-e2e-stream");
const { registerE2EAuthRoutes } = require("./routes/api-e2e-auth");

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.CONSOLE_PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
app.locals.projectRoot = path.resolve(__dirname, "..");

// --- Middleware ordering matters ---

// 1. Raw body for GitHub App webhooks (BEFORE express.json)
//    Webhook signature verification needs the raw Buffer.
app.use("/webhooks/github-app", express.raw({ type: "application/json" }));

// 2. Standard body parsers for everything else
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- Exact-match rate limiting for public routes ---

createPublicRouteGuards()(app);

// --- Auth enforcement boundary — operator /api/* routes ---

app.use("/api", (req, res, next) => {
  const operatorId = req.cookies?.operatorId;
  if (!operatorId) {
    if (process.env.NODE_ENV !== "production") {
      req.operatorId = "dev-operator";
      return next();
    }
    return res.status(401).json({ error: "Authentication required" });
  }
  req.operatorId = operatorId;
  next();
});

// --- Auth for /internal/* routes (server-to-server, secret-based) ---

app.use("/internal", (req, res, next) => {
  const secret = process.env.BUILD_INTERNAL_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "Internal routes not configured" });
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Invalid internal secret" });
  }
  next();
});

// --- Database and services ---

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const db = createDatabase(dataDir);
startAuthStateCleanup(db);
const eventStore = createEventStore(db);
const orchestrator = createOrchestrator({
  projectRoot: path.resolve(__dirname, ".."),
  dataDir: path.join(__dirname, "data"),
  eventStore,
});

// --- Operator API routes (existing, unchanged) ---

registerPreflightRoutes(app, { runPreflight });
registerRunRoutes(app, { orchestrator, eventStore });
registerRunStreamRoutes(app, { eventStore });
registerRunsRoutes(app, { eventStore });
registerQueueRoutes(app, { eventStore });
registerRunDecisionRoutes(app, { eventStore });
registerRunAuditRoutes(app, { eventStore });
registerAccessCodeRoutes(app, { db });

// --- Public routes (real or demo mode) ---

const buildSessionStore = createBuildSessionStore(db);
const serviceResolver = createServiceResolver({ db, buildSessionStore });
const e2eHarness = createE2EHarness({
  db,
  buildSessionStore,
  serviceResolver,
  projectRoot: path.resolve(__dirname, ".."),
  baseUrl: process.env.API_URL || `http://${host}:${port}`,
  studioUrl: process.env.FRONTEND_URL || "http://127.0.0.1:3001",
});

registerE2ERunRoutes(app, { harness: e2eHarness });
registerE2EStreamRoutes(app, { harness: e2eHarness });
registerE2EAuthRoutes(app, { harness: e2eHarness, db });

// DEMO_MODE env var: when set, register mock auth globally (all-mock deployment).
// Otherwise register real OAuth. Per-session demo is always available via the API.
const DEMO_MODE = process.env.DEMO_MODE === "true";
if (DEMO_MODE) {
  const mock = require("./lib/mock-services");
  mock.registerMockAuthRoutes(app, { db });
  console.log("DEMO_MODE enabled — mock auth registered globally");
} else {
  registerPubAuthRoutes(app, { db });
}

registerBuildSessionRoutes(app, { db, buildSessionStore, serviceResolver });
registerBuildStreamRoutes(app, { db, buildSessionStore });
registerProvisionRoutes(app, { db, serviceResolver });

// --- Internal routes (behind /internal auth middleware) ---

registerInternalBuildRoutes(app, { buildSessionStore, serviceResolver });
registerInternalAccessCodeRoutes(app, { db });

// --- Webhook routes ---

registerWebhookRoutes(app, { db, buildSessionStore, serviceResolver });

// --- Health check ---

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, host, () => {
  console.log(`Operator console listening on http://${host}:${port}`);
});
