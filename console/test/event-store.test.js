const { createDatabase } = require("../lib/db");
const { createEventStore } = require("../lib/event-store");
const fs = require("fs");
const path = require("path");
const os = require("os");

let db;
let store;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-test-"));
  db = createDatabase(tmpDir);
  store = createEventStore(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("createRun persists a run", () => {
  store.createRun({
    id: "r1",
    createdAt: "2026-03-11T10:00:00Z",
    updatedAt: "2026-03-11T10:00:00Z",
    status: "queued",
    mode: "new",
    inputSource: "notes",
  });
  const run = store.getRun("r1");
  expect(run).not.toBeNull();
  expect(run.id).toBe("r1");
  expect(run.status).toBe("queued");
});

test("listRuns returns runs sorted by createdAt desc", () => {
  store.createRun({ id: "r1", createdAt: "2026-03-11T09:00:00Z", updatedAt: "2026-03-11T09:00:00Z", status: "queued", mode: "new", inputSource: "notes" });
  store.createRun({ id: "r2", createdAt: "2026-03-11T10:00:00Z", updatedAt: "2026-03-11T10:00:00Z", status: "queued", mode: "new", inputSource: "notes" });
  const runs = store.listRuns();
  expect(runs[0].id).toBe("r2");
  expect(runs[1].id).toBe("r1");
});

test("appendEvent stores and retrieves events", () => {
  store.createRun({ id: "r1", createdAt: "2026-03-11T10:00:00Z", updatedAt: "2026-03-11T10:00:00Z", status: "queued", mode: "new", inputSource: "notes" });
  store.appendEvent("r1", {
    id: "e1",
    stage: "EXTRACT",
    type: "system",
    kind: "stage_start",
    data: { label: "Starting extraction" },
    timestamp: "2026-03-11T10:00:01Z",
  });
  const run = store.getRun("r1");
  expect(run.events).toHaveLength(1);
  expect(run.events[0].id).toBe("e1");
  expect(run.events[0].data.label).toBe("Starting extraction");
});

test("appendEvent with type blocked creates queue item", () => {
  store.createRun({ id: "r1", createdAt: "2026-03-11T10:00:00Z", updatedAt: "2026-03-11T10:00:00Z", status: "queued", mode: "new", inputSource: "notes" });
  store.appendEvent("r1", {
    id: "e1",
    stage: "BUILD",
    type: "blocked",
    kind: "stage_start",
    data: {
      event: "Deploy to production",
      ref: "PR #342",
      reason: "Policy: production deploys require operator approval",
      policyRule: "autonomy-policy.yml#deploy-gate",
    },
    timestamp: "2026-03-11T10:05:00Z",
  });
  const queue = store.listQueue();
  expect(queue).toHaveLength(1);
  expect(queue[0].event).toBe("Deploy to production");
  expect(queue[0].status).toBe("pending");
});

test("updateRun persists status changes", () => {
  store.createRun({ id: "r1", createdAt: "2026-03-11T10:00:00Z", updatedAt: "2026-03-11T10:00:00Z", status: "queued", mode: "new", inputSource: "notes" });
  store.updateRun("r1", { status: "running", updatedAt: "2026-03-11T10:01:00Z" });
  const run = store.getRun("r1");
  expect(run.status).toBe("running");
});

test("subscribe emits events to listeners", (done) => {
  store.createRun({ id: "r1", createdAt: "2026-03-11T10:00:00Z", updatedAt: "2026-03-11T10:00:00Z", status: "queued", mode: "new", inputSource: "notes" });
  const unsubscribe = store.subscribe("r1", (event) => {
    expect(event.id).toBe("e1");
    unsubscribe();
    done();
  });
  store.appendEvent("r1", {
    id: "e1",
    stage: "EXTRACT",
    type: "system",
    kind: "stage_start",
    data: {},
    timestamp: "2026-03-11T10:00:01Z",
  });
});

test("data survives db close and reopen", () => {
  store.createRun({ id: "r1", createdAt: "2026-03-11T10:00:00Z", updatedAt: "2026-03-11T10:00:00Z", status: "queued", mode: "new", inputSource: "notes" });
  store.appendEvent("r1", { id: "e1", stage: "EXTRACT", type: "system", kind: "stage_start", data: {}, timestamp: "2026-03-11T10:00:01Z" });
  db.close();

  const db2 = createDatabase(tmpDir);
  const store2 = createEventStore(db2);
  const run = store2.getRun("r1");
  expect(run).not.toBeNull();
  expect(run.events).toHaveLength(1);
  db2.close();
});
