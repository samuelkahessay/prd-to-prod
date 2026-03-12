const express = require("express");
const path = require("path");

const { createDatabase } = require("./lib/db");
const { createEventStore } = require("./lib/event-store");
const { createOrchestrator } = require("./lib/orchestrator");
const { runPreflight } = require("./lib/preflight");
const { registerPreflightRoutes } = require("./routes/api-preflight");
const { registerRunRoutes } = require("./routes/api-run");
const { registerRunStreamRoutes } = require("./routes/api-run-stream");
const { registerHistoryRoutes } = require("./routes/api-history");

const app = express();
const port = Number(process.env.CONSOLE_PORT || 3000);
app.locals.projectRoot = path.resolve(__dirname, "..");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

const db = createDatabase(path.join(__dirname, "data"));
const eventStore = createEventStore(db);
const orchestrator = createOrchestrator({
  projectRoot: path.resolve(__dirname, ".."),
  dataDir: path.join(__dirname, "data"),
  eventStore,
});

registerPreflightRoutes(app, { runPreflight });
registerRunRoutes(app, { orchestrator, eventStore });
registerRunStreamRoutes(app, { eventStore });
registerHistoryRoutes(app, { eventStore });

app.use(express.static(path.join(__dirname, "public")));

app.get("/run/:id", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "run.html"));
});

app.get("/history", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "history.html"));
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Operator console listening on http://127.0.0.1:${port}`);
});
