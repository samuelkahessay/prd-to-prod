# Console Productization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate two web stacks (Node console + .NET operator dashboard) into a single Next.js frontend (`web/`) backed by the existing Express API, with a public landing page at `/` and an operator console at `/console`.

**Architecture:** `web/` (Next.js 15 + React 19) serves all UI. `console/` stays as the persistent Express API with SQLite-backed event store. Landing page is SSG with build-time GitHub data. Console pages are dynamic, hitting the Express API via Next.js rewrites. Auth middleware on all `/api/*` routes (enforcement boundary only — full auth deferred).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, better-sqlite3, DM Sans + JetBrains Mono, oklch color palette

**Spec:** `docs/superpowers/specs/2026-03-11-console-productization-design.md`
**Mockups:** `.superpowers/brainstorm/53633-1773285939/` (landing-v2.html, console-structure.html)

---

## File Structure

### web/ (new files)

```
web/
├── package.json              (update — add dependencies)
├── tsconfig.json              (create — TypeScript config)
├── next.config.ts             (create — API rewrites to Express)
├── app/
│   ├── layout.tsx             (root layout — fonts, metadata)
│   ├── globals.css            (design tokens — colors, type, spacing)
│   ├── page.tsx               (landing page — SSG)
│   └── console/
│       ├── layout.tsx         (console shell — nav, auth guard)
│       ├── page.tsx           (launch + queue + runs)
│       └── runs/
│           └── [id]/
│               └── page.tsx   (run detail — stage track, audit, artifacts)
├── components/
│   ├── landing/
│   │   ├── hero.tsx
│   │   ├── how-it-works.tsx
│   │   ├── contrast-list.tsx
│   │   ├── evidence-ledger.tsx
│   │   └── bottom-cta.tsx
│   └── console/
│       ├── console-nav.tsx
│       ├── launch-form.tsx
│       ├── preflight-panel.tsx
│       ├── queue-panel.tsx
│       ├── runs-table.tsx
│       ├── stage-track.tsx
│       ├── decision-trail.tsx
│       └── artifacts-list.tsx
└── lib/
    ├── types.ts               (shared TypeScript types)
    ├── api.ts                 (Express API client)
    └── github.ts              (GitHub API for SSG evidence)
```

### console/ (modified files)

```
console/
├── package.json               (modify — add better-sqlite3)
├── server.js                  (modify — add new routes, auth middleware, remove static serving)
├── lib/
│   ├── db.js                  (create — SQLite connection + schema)
│   ├── event-store.js         (rewrite — SQLite-backed)
│   └── orchestrator.js        (modify — typed events)
└── routes/
    ├── api-preflight.js       (no change)
    ├── api-run.js             (no change)
    ├── api-run-stream.js      (no change)
    ├── api-runs.js            (create — renamed from api-history.js)
    ├── api-queue.js           (create — queue list + resolve)
    ├── api-run-decisions.js   (create — decision events per run)
    └── api-run-audit.js       (create — full audit trail per run)
```

---

## Chunk 1: Foundation

### Task 1: Initialize Studio Project

**Files:**
- Modify: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/app/layout.tsx`
- Create: `web/app/globals.css`
- Create: `web/app/page.tsx`

- [ ] **Step 1: Install Next.js dependencies**

```bash
cd web && npm install next@latest react@latest react-dom@latest && npm install -D typescript @types/react @types/node
```

- [ ] **Step 2: Create TypeScript config**

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create Next.js config with API rewrites**

Create `web/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  async rewrites() {
    const apiTarget = process.env.API_URL || "http://127.0.0.1:3000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default config;
```

- [ ] **Step 4: Create design tokens**

Create `web/app/globals.css` with the full oklch palette, type scale, and shared traits from the spec. Reference: spec lines 169-208 and mockup `landing-v2.html` CSS variables.

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,900;1,400&family=JetBrains+Mono:wght@400;500&display=swap");

:root {
  --cream: oklch(97.5% 0.004 75);
  --surface: oklch(96% 0.004 75);
  --warm-white: oklch(99% 0.002 75);
  --ink: oklch(16% 0.01 55);
  --ink-mid: oklch(35% 0.01 55);
  --ink-muted: oklch(50% 0.01 55);
  --ink-faint: oklch(70% 0.008 55);
  --accent: oklch(56% 0.1 255);
  --accent-wash: oklch(94% 0.02 255);
  --good: oklch(48% 0.12 155);
  --good-wash: oklch(94% 0.03 155);
  --heal: oklch(50% 0.14 30);
  --heal-wash: oklch(95% 0.02 30);
  --policy: oklch(52% 0.12 300);
  --policy-wash: oklch(94% 0.03 300);
  --rule: oklch(88% 0.008 75);
  --rule-strong: oklch(78% 0.01 75);
  --danger: oklch(50% 0.16 25);

  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  background: var(--cream);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 5: Create root layout**

Create `web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "prd-to-prod",
  description:
    "Autonomous software delivery pipeline. Brief in. Production out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create placeholder landing page**

Create `web/app/page.tsx`:

```tsx
export default function LandingPage() {
  return (
    <main>
      <h1>Brief in. Production out.</h1>
      <p>Landing page — under construction</p>
    </main>
  );
}
```

- [ ] **Step 7: Verify the dev server starts**

```bash
cd web && npm run dev
```

Open http://localhost:3001 (or whatever port Next.js picks). Verify the placeholder page renders with correct fonts and cream background.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat(web): initialize Next.js project with design tokens and API rewrites"
```

---

### Task 2: Create Shared Types

**Files:**
- Create: `web/lib/types.ts`

- [ ] **Step 1: Define TypeScript types matching the API contract**

Create `web/lib/types.ts`:

```typescript
// Run types
export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface Run {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: RunStatus;
  mode: "new" | "existing";
  inputSource: "workiq" | "notes";
  targetRepo: string;
  summary: string;
  events?: RunEvent[];
}

export type EventType = "system" | "auto" | "blocked" | "human";
export type EventKind =
  | "stage_start"
  | "stage_complete"
  | "stage_error"
  | "progress"
  | "log"
  | "artifact"
  | "run_complete"
  | "run_error";

export interface RunEvent {
  id: string;
  stage: string;
  type: EventType;
  kind: EventKind;
  data: Record<string, unknown>;
  timestamp: string;
}

// Stage types for the UI projection
export type StageName = "Extract" | "Build" | "Review" | "Policy" | "Deploy";
export type StageState = "done" | "active" | "blocked" | "pending";

export interface StageStatus {
  name: StageName;
  state: StageState;
  label: string;
}

// Queue types
export type Resolution = "approved" | "rejected";

export interface QueueItem {
  id: string;
  runId: string;
  event: string;
  ref: string;
  reason: string;
  policyRule: string;
  queuedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: Resolution;
}

// Decision types
export interface Decision {
  timestamp: string;
  type: EventType;
  event: string;
  detail: string;
  policyRef?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: Resolution;
}

// Audit types
export interface AuditEntry {
  timestamp: string;
  type: EventType;
  event: string;
  detail: string;
  ref: string | null;
}

// Preflight types
export interface PreflightCheck {
  id: string;
  name: string;
  required: boolean;
  present: boolean;
}

// Evidence types (for SSG landing page)
export type EvidenceOutcome =
  | "running"
  | "merged"
  | "healed"
  | "blocked"
  | "drill";

export interface EvidenceRow {
  time: string;
  event: string;
  refs: { label: string; url: string; type: "issue" | "pr" | "heal" | "policy" }[];
  duration: string | null;
  outcome: EvidenceOutcome;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat(web): add shared TypeScript types for API contract"
```

---

### Task 3: Create API Client

**Files:**
- Create: `web/lib/api.ts`

- [ ] **Step 1: Write the API client**

Create `web/lib/api.ts`. This wraps `fetch` calls to the Express API (proxied through Next.js rewrites in dev, reverse proxy in prod).

```typescript
import type {
  Run,
  QueueItem,
  Decision,
  AuditEntry,
  PreflightCheck,
} from "./types";

const BASE = "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  preflight: () =>
    get<{ checks: PreflightCheck[] }>("/api/preflight").then((r) => r.checks),

  startRun: (payload: {
    inputSource: string;
    query?: string;
    notes?: string;
    mode: string;
    targetRepo?: string;
    mockMode?: boolean;
  }) => post<{ runId: string }>("/api/run", payload),

  getRun: (id: string) => get<Run>(`/api/run/${id}`),

  listRuns: () => get<{ runs: Run[] }>("/api/runs").then((r) => r.runs),

  streamRun: (id: string, onEvent: (event: unknown) => void) => {
    const source = new EventSource(`/api/run/${id}/stream`);
    source.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => source.close();
  },

  getQueue: () => get<QueueItem[]>("/api/queue"),

  resolveQueueItem: (id: string, resolution: "approved" | "rejected") =>
    post<QueueItem>(`/api/queue/${id}/resolve`, { resolution }),

  getDecisions: (runId: string) =>
    get<Decision[]>(`/api/run/${runId}/decisions`),

  getAudit: (runId: string) =>
    get<AuditEntry[]>(`/api/run/${runId}/audit`),
};
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/api.ts
git commit -m "feat(web): add API client for Express backend"
```

---

## Chunk 2: Backend — SQLite + Route Changes

### Task 4: Install SQLite and Create Database Module

**Files:**
- Modify: `console/package.json`
- Create: `console/lib/db.js`

- [ ] **Step 1: Install better-sqlite3**

```bash
cd console && npm install better-sqlite3
```

- [ ] **Step 2: Create database module with schema**

Create `console/lib/db.js`:

```javascript
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function createDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "console.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      mode TEXT NOT NULL,
      input_source TEXT NOT NULL,
      target_repo TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      timestamp TEXT NOT NULL,
      stage TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      kind TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
    CREATE INDEX IF NOT EXISTS idx_run_events_type ON run_events(type);

    CREATE TABLE IF NOT EXISTS queue_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      source_event_id TEXT NOT NULL REFERENCES run_events(id),
      event TEXT NOT NULL,
      ref TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL,
      policy_rule TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      queued_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT,
      resolution TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id),
      FOREIGN KEY (source_event_id) REFERENCES run_events(id)
    );

    CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status);
    CREATE INDEX IF NOT EXISTS idx_queue_items_run_id ON queue_items(run_id);
  `);

  return db;
}

module.exports = { createDatabase };
```

- [ ] **Step 3: Write test for database schema**

Create `console/test/db.test.js`:

```javascript
const { createDatabase } = require("../lib/db");
const fs = require("fs");
const path = require("path");
const os = require("os");

let db;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-test-"));
  db = createDatabase(tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("creates all tables", () => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);
  expect(tables).toContain("runs");
  expect(tables).toContain("run_events");
  expect(tables).toContain("queue_items");
});

test("foreign key enforcement is on", () => {
  const fk = db.prepare("PRAGMA foreign_keys").get();
  expect(fk.foreign_keys).toBe(1);
});

test("inserting a queue_item with invalid run_id fails", () => {
  expect(() => {
    db.prepare(
      `INSERT INTO queue_items (id, run_id, source_event_id, event, reason, queued_at)
       VALUES ('q1', 'nonexistent', 'e1', 'test', 'test', '2026-01-01T00:00:00Z')`
    ).run();
  }).toThrow();
});
```

- [ ] **Step 4: Install test runner and run tests**

```bash
cd console && npm install -D jest
npx jest test/db.test.js --verbose
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add console/package.json console/package-lock.json console/lib/db.js console/test/db.test.js
git commit -m "feat(console): add SQLite database module with schema"
```

---

### Task 5: Rewrite Event Store with SQLite

**Files:**
- Modify: `console/lib/event-store.js`
- Create: `console/test/event-store.test.js`

- [ ] **Step 1: Write tests for SQLite-backed event store**

Create `console/test/event-store.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd console && npx jest test/event-store.test.js --verbose
```

Expected: FAIL — the current `createEventStore()` doesn't accept a `db` parameter.

- [ ] **Step 3: Rewrite event-store.js with SQLite backing**

Replace `console/lib/event-store.js`:

```javascript
const { EventEmitter } = require("events");

function createEventStore(db) {
  const emitters = new Map();

  function getEmitter(runId) {
    if (!emitters.has(runId)) {
      emitters.set(runId, new EventEmitter());
    }
    return emitters.get(runId);
  }

  return {
    createRun(run) {
      db.prepare(
        `INSERT INTO runs (id, created_at, updated_at, status, mode, input_source, target_repo, summary)
         VALUES (@id, @createdAt, @updatedAt, @status, @mode, @inputSource, @targetRepo, @summary)`
      ).run({
        id: run.id,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        status: run.status,
        mode: run.mode,
        inputSource: run.inputSource,
        targetRepo: run.targetRepo || "",
        summary: run.summary || "",
      });
      return this.getRun(run.id);
    },

    getRun(id) {
      const row = db
        .prepare("SELECT * FROM runs WHERE id = ?")
        .get(id);
      if (!row) return null;

      const events = db
        .prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY timestamp ASC")
        .all(id)
        .map((e) => ({
          id: e.id,
          stage: e.stage,
          type: e.type,
          kind: e.kind,
          data: JSON.parse(e.data),
          timestamp: e.timestamp,
        }));

      return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        mode: row.mode,
        inputSource: row.input_source,
        targetRepo: row.target_repo,
        summary: row.summary,
        events,
      };
    },

    listRuns() {
      return db
        .prepare("SELECT * FROM runs ORDER BY created_at DESC")
        .all()
        .map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          status: row.status,
          mode: row.mode,
          inputSource: row.input_source,
          targetRepo: row.target_repo,
          summary: row.summary,
        }));
    },

    appendEvent(runId, event) {
      const run = db.prepare("SELECT id FROM runs WHERE id = ?").get(runId);
      if (!run) return;

      db.prepare(
        `INSERT INTO run_events (id, run_id, timestamp, stage, type, kind, data)
         VALUES (@id, @runId, @timestamp, @stage, @type, @kind, @data)`
      ).run({
        id: event.id,
        runId,
        timestamp: event.timestamp,
        stage: event.stage,
        type: event.type || "system",
        kind: event.kind || event.type,
        data: JSON.stringify(event.data || {}),
      });

      db.prepare("UPDATE runs SET updated_at = ? WHERE id = ?").run(
        event.timestamp,
        runId
      );

      // If this is a blocked event, create a durable queue item
      if (event.type === "blocked" && event.data) {
        const queueId = require("crypto").randomUUID();
        db.prepare(
          `INSERT INTO queue_items (id, run_id, source_event_id, event, ref, reason, policy_rule, status, queued_at)
           VALUES (@id, @runId, @sourceEventId, @event, @ref, @reason, @policyRule, 'pending', @queuedAt)`
        ).run({
          id: queueId,
          runId,
          sourceEventId: event.id,
          event: event.data.event || "",
          ref: event.data.ref || "",
          reason: event.data.reason || "",
          policyRule: event.data.policyRule || "",
          queuedAt: event.timestamp,
        });
      }

      getEmitter(runId).emit("event", event);
    },

    subscribe(runId, listener) {
      const emitter = getEmitter(runId);
      emitter.on("event", listener);
      return () => emitter.off("event", listener);
    },

    updateRun(runId, patch) {
      const run = db.prepare("SELECT id FROM runs WHERE id = ?").get(runId);
      if (!run) return;

      if (patch.status) {
        db.prepare("UPDATE runs SET status = ? WHERE id = ?").run(
          patch.status,
          runId
        );
      }
      if (patch.updatedAt) {
        db.prepare("UPDATE runs SET updated_at = ? WHERE id = ?").run(
          patch.updatedAt,
          runId
        );
      }
    },

    // Queue operations
    listQueue() {
      return db
        .prepare(
          `SELECT qi.*, r.summary as run_summary
           FROM queue_items qi
           JOIN runs r ON r.id = qi.run_id
           WHERE qi.status = 'pending'
           ORDER BY qi.queued_at ASC`
        )
        .all()
        .map((row) => ({
          id: row.id,
          runId: row.run_id,
          event: row.event,
          ref: row.ref,
          reason: row.reason,
          policyRule: row.policy_rule,
          status: row.status,
          queuedAt: row.queued_at,
          resolvedAt: row.resolved_at,
          resolvedBy: row.resolved_by,
          resolution: row.resolution,
        }));
    },

    resolveQueueItem(queueId, { resolution, operatorId }) {
      const item = db
        .prepare("SELECT * FROM queue_items WHERE id = ?")
        .get(queueId);
      if (!item) return null;

      if (item.status !== "pending") {
        if (item.resolution === resolution) {
          // Idempotent — same resolution, return existing
          return {
            id: item.id,
            runId: item.run_id,
            event: item.event,
            resolution: item.resolution,
            resolvedAt: item.resolved_at,
            resolvedBy: item.resolved_by,
          };
        }
        // Conflict — different resolution
        return { conflict: true, existingResolution: item.resolution };
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE queue_items SET status = 'resolved', resolution = ?, resolved_at = ?, resolved_by = ?
         WHERE id = ?`
      ).run(resolution, now, operatorId, queueId);

      // Emit a human event into run_events
      const eventId = require("crypto").randomUUID();
      this.appendEvent(item.run_id, {
        id: eventId,
        stage: "BUILD",
        type: "human",
        kind: "queue_resolved",
        data: {
          queueItemId: queueId,
          resolution,
          operatorId,
          event: item.event,
        },
        timestamp: now,
      });

      return {
        id: item.id,
        runId: item.run_id,
        event: item.event,
        resolution,
        resolvedAt: now,
        resolvedBy: operatorId,
      };
    },

    // Decision and audit queries
    getDecisions(runId) {
      return db
        .prepare(
          `SELECT * FROM run_events
           WHERE run_id = ? AND type IN ('blocked', 'human')
           ORDER BY timestamp ASC`
        )
        .all(runId)
        .map((e) => {
          const data = JSON.parse(e.data);
          return {
            timestamp: e.timestamp,
            type: e.type,
            event: data.event || e.kind,
            detail: data.reason || data.detail || "",
            policyRef: data.policyRule || null,
            resolvedBy: data.operatorId || null,
            resolvedAt: data.resolvedAt || null,
            resolution: data.resolution || null,
          };
        });
    },

    getAudit(runId) {
      return db
        .prepare(
          "SELECT * FROM run_events WHERE run_id = ? ORDER BY timestamp ASC"
        )
        .all(runId)
        .map((e) => {
          const data = JSON.parse(e.data);
          return {
            timestamp: e.timestamp,
            type: e.type,
            event: data.label || data.event || data.message || e.kind,
            detail: data.reason || data.detail || "",
            ref: data.ref || null,
          };
        });
    },
  };
}

module.exports = { createEventStore };
```

- [ ] **Step 4: Run tests**

```bash
cd console && npx jest test/event-store.test.js --verbose
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add console/lib/event-store.js console/test/
git commit -m "feat(console): rewrite event store with SQLite persistence"
```

---

### Task 6: Update Orchestrator for Typed Events

**Files:**
- Modify: `console/lib/orchestrator.js`

- [ ] **Step 1: Update the orchestrator's appendEvent to include event type**

In `console/lib/orchestrator.js`, update the `appendEvent` function (line 45-53) to pass the `type` field. The orchestrator currently emits events without a `type` — all should default to `"auto"` since they're autonomous system actions.

Change the `appendEvent` function inside `createOrchestrator`:

```javascript
function appendEvent(runId, stage, kind, data, type = "auto") {
  eventStore.appendEvent(runId, {
    id: crypto.randomUUID(),
    stage,
    type,
    kind,
    data,
    timestamp: new Date().toISOString(),
  });
}
```

Note: The old `type` parameter in the function body was being used as `kind` (e.g., `"stage_start"`, `"progress"`). Now `kind` is the event kind and `type` is the event category (`system`/`auto`/`blocked`/`human`).

Update all call sites in the same file — change the third argument name from `type` to `kind`:
- Line 101: `appendEvent(runId, "EXTRACT", "stage_start", { ... })` → no change needed, just rename parameter
- All existing calls keep working because the parameter order stayed the same (stage, kind, data)

- [ ] **Step 2: Remove persistHistory and loadHistory**

The orchestrator currently writes `history.json` as a persistence mechanism. With SQLite backing, this is no longer needed. Remove:
- The `persistHistory` function (lines 14-26)
- The `loadHistory` function (lines 28-37)
- All `persistHistory()` calls (lines 53, 77, 186)
- The `historyPath` variable (line 12)
- The `listRuns` method's fallback to `loadHistory()` (lines 57-63) — simplify to just `return eventStore.listRuns();`

- [ ] **Step 3: Update server.js to pass database to event store**

Modify `console/server.js`:

```javascript
const { createDatabase } = require("./lib/db");
const { createEventStore } = require("./lib/event-store");
// ... rest of imports unchanged

const db = createDatabase(path.join(__dirname, "data"));
const eventStore = createEventStore(db);
const orchestrator = createOrchestrator({
  projectRoot: path.resolve(__dirname, ".."),
  dataDir: path.join(__dirname, "data"),
  eventStore,
});
```

- [ ] **Step 4: Verify existing API still works**

```bash
cd console && node server.js &
curl http://127.0.0.1:3000/api/preflight | jq .
kill %1
```

Expected: Preflight check returns JSON with all check items.

- [ ] **Step 5: Commit**

```bash
git add console/lib/orchestrator.js console/server.js
git commit -m "feat(console): update orchestrator for typed events, remove JSON persistence"
```

---

### Task 7: Add New API Routes

**Files:**
- Create: `console/routes/api-runs.js`
- Create: `console/routes/api-queue.js`
- Create: `console/routes/api-run-decisions.js`
- Create: `console/routes/api-run-audit.js`
- Modify: `console/server.js`
- Delete: `console/routes/api-history.js`

- [ ] **Step 1: Create api-runs.js (replaces api-history.js)**

Create `console/routes/api-runs.js`:

```javascript
function registerRunsRoutes(app, { eventStore }) {
  app.get("/api/runs", (_req, res) => {
    res.json({ runs: eventStore.listRuns() });
  });
}

module.exports = { registerRunsRoutes };
```

- [ ] **Step 2: Create api-queue.js**

Create `console/routes/api-queue.js`:

```javascript
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
```

- [ ] **Step 3: Create api-run-decisions.js**

Create `console/routes/api-run-decisions.js`:

```javascript
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
```

- [ ] **Step 4: Create api-run-audit.js**

Create `console/routes/api-run-audit.js`:

```javascript
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
```

- [ ] **Step 5: Update server.js to register new routes**

Replace the route registration section of `console/server.js`:

```javascript
const { registerPreflightRoutes } = require("./routes/api-preflight");
const { registerRunRoutes } = require("./routes/api-run");
const { registerRunStreamRoutes } = require("./routes/api-run-stream");
const { registerRunsRoutes } = require("./routes/api-runs");
const { registerQueueRoutes } = require("./routes/api-queue");
const { registerRunDecisionRoutes } = require("./routes/api-run-decisions");
const { registerRunAuditRoutes } = require("./routes/api-run-audit");

// ... after eventStore and orchestrator creation:

registerPreflightRoutes(app, { runPreflight });
registerRunRoutes(app, { orchestrator, eventStore });
registerRunStreamRoutes(app, { eventStore });
registerRunsRoutes(app, { eventStore });
registerQueueRoutes(app, { eventStore });
registerRunDecisionRoutes(app, { eventStore });
registerRunAuditRoutes(app, { eventStore });
```

Remove the `registerHistoryRoutes` import and call. Keep `api-history.js` until the old console UI is retired (it may still reference `/api/history`).

- [ ] **Step 6: Add auth middleware stub**

Create auth enforcement boundary in `console/server.js`. This is the stub — full auth is deferred to a follow-up spec.

Add before route registration:

```javascript
// Auth enforcement boundary — all /api/* and /console/* require operator session
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
```

Add `cookie-parser` dependency:

```bash
cd console && npm install cookie-parser
```

Add to server.js imports and middleware:

```javascript
const cookieParser = require("cookie-parser");
// ... after express.json():
app.use(cookieParser());
```

- [ ] **Step 7: Verify new endpoints**

```bash
cd console && node server.js &
curl http://127.0.0.1:3000/api/runs | jq .
curl http://127.0.0.1:3000/api/queue | jq .
kill %1
```

Expected: Both return empty arrays/objects (no runs yet).

- [ ] **Step 8: Commit**

```bash
git add console/routes/ console/server.js console/package.json console/package-lock.json
git commit -m "feat(console): add queue, decisions, audit endpoints with auth boundary"
```

---

## Chunk 3: Landing Page

### Task 8: GitHub Data Fetcher for Evidence Section

**Files:**
- Create: `web/lib/github.ts`

- [ ] **Step 1: Create GitHub API data fetcher**

This runs at build time (SSG) to fetch recent pipeline activity from the GitHub repo.

Create `web/lib/github.ts`:

```typescript
import type { EvidenceRow, EvidenceOutcome } from "./types";

const REPO = process.env.GITHUB_REPO || "samuelkahessay/prd-to-prod";

interface GitHubIssue {
  number: number;
  title: string;
  created_at: string;
  labels: { name: string }[];
  pull_request?: { html_url: string };
  html_url: string;
  state: string;
}

interface GitHubPR {
  number: number;
  title: string;
  created_at: string;
  merged_at: string | null;
  html_url: string;
  labels: { name: string }[];
  user: { login: string };
}

async function githubFetch<T>(endpoint: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN || "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

function classifyOutcome(
  issue: GitHubIssue,
  pr: GitHubPR | null
): EvidenceOutcome {
  const labels = issue.labels.map((l) => l.name);
  if (labels.includes("drill")) return "drill";
  if (labels.includes("bug") && pr?.merged_at) return "healed";
  if (pr?.merged_at) return "merged";
  if (issue.state === "open") return "running";
  return "merged";
}

function formatDuration(start: string, end: string | null): string | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (d.toDateString() === now.toDateString()) return `${time} today`;
  return `${day} ${time}`;
}

export async function fetchEvidenceData(): Promise<EvidenceRow[]> {
  try {
    const [issues, prs] = await Promise.all([
      githubFetch<GitHubIssue[]>(
        `/repos/${REPO}/issues?labels=pipeline&state=all&sort=created&direction=desc&per_page=10`
      ),
      githubFetch<GitHubPR[]>(
        `/repos/${REPO}/pulls?state=all&sort=created&direction=desc&per_page=20`
      ),
    ]);

    const prByTitle = new Map<string, GitHubPR>();
    for (const pr of prs) {
      prByTitle.set(pr.title.toLowerCase(), pr);
    }

    const rows: EvidenceRow[] = [];

    for (const issue of issues.slice(0, 8)) {
      const matchingPr =
        prs.find(
          (pr) =>
            pr.title.toLowerCase().includes(`#${issue.number}`) ||
            pr.body?.includes(`#${issue.number}`)
        ) || null;

      const outcome = classifyOutcome(issue, matchingPr);
      const refs: EvidenceRow["refs"] = [
        {
          label: `#${issue.number}`,
          url: issue.html_url,
          type: outcome === "healed" ? "heal" : "issue",
        },
      ];

      if (matchingPr) {
        refs.push({
          label: `PR #${matchingPr.number}`,
          url: matchingPr.html_url,
          type: outcome === "healed" ? "heal" : "pr",
        });
      }

      rows.push({
        time: formatTime(issue.created_at),
        event: issue.title,
        refs,
        duration: matchingPr
          ? formatDuration(issue.created_at, matchingPr.merged_at)
          : null,
        outcome,
      });
    }

    return rows;
  } catch (error) {
    console.error("Failed to fetch evidence data:", error);
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/github.ts
git commit -m "feat(web): add GitHub data fetcher for landing page evidence"
```

---

### Task 9: Build Landing Page

**Files:**
- Modify: `web/app/page.tsx`
- Create: `web/components/landing/hero.tsx`
- Create: `web/components/landing/how-it-works.tsx`
- Create: `web/components/landing/contrast-list.tsx`
- Create: `web/components/landing/evidence-ledger.tsx`
- Create: `web/components/landing/bottom-cta.tsx`

Reference mockup: `.superpowers/brainstorm/53633-1773285939/landing-v2.html`

The landing page components translate the approved mockup into React. The CSS uses the design tokens from `globals.css`. Each component is self-contained with a CSS module.

- [ ] **Step 1: Create hero component**

Create `web/components/landing/hero.tsx` and `web/components/landing/hero.module.css`.

The hero implements the left-aligned, asymmetric two-column layout from the mockup:
- Left: headline (900 weight first line, 300 italic second), subtitle, CTA buttons
- Right: pipeline animation well with act labels
- Reference: `landing-v2.html` lines 131-162

CSS module uses the expressive register type scale: `clamp(52px, 6.5vw, 88px)` for h1.

- [ ] **Step 2: Create how-it-works component**

Create `web/components/landing/how-it-works.tsx` and `web/components/landing/how-it-works.module.css`.

Three-column grid with the third column (Recover) at 1.4x width, heal-colored top border, and the concrete `BLOCKED` boundary example in monospace.

Reference: `landing-v2.html` lines 167-199

- [ ] **Step 3: Create contrast-list component**

Create `web/components/landing/contrast-list.tsx` and `web/components/landing/contrast-list.module.css`.

NOT/IS flat list with muted/weighted text contrast.

Reference: `landing-v2.html` lines 206-240

- [ ] **Step 4: Create evidence-ledger component**

Create `web/components/landing/evidence-ledger.tsx` and `web/components/landing/evidence-ledger.module.css`.

Server component that receives evidence data as props. Renders the ledger table with column headers (Time / Event / Duration / Outcome), color-coded outcome dots, and mono-styled refs that link to GitHub.

Reference: `landing-v2.html` lines 247-290. Key difference from mockup: data comes from the `fetchEvidenceData()` function at build time, not hardcoded.

Fallback when no data: "Recent activity unavailable" message.

- [ ] **Step 5: Create bottom-cta component**

Create `web/components/landing/bottom-cta.tsx` and `web/components/landing/bottom-cta.module.css`.

Left-aligned CTA section: "See the pipeline run." + "Open console" button + "View on GitHub →" link.

Reference: `landing-v2.html` lines 293-302

- [ ] **Step 6: Assemble landing page**

Update `web/app/page.tsx`:

```tsx
import { fetchEvidenceData } from "@/lib/github";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ContrastList } from "@/components/landing/contrast-list";
import { EvidenceLedger } from "@/components/landing/evidence-ledger";
import { BottomCta } from "@/components/landing/bottom-cta";
import styles from "./page.module.css";

export default async function LandingPage() {
  const evidence = await fetchEvidenceData();

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>prd-to-prod</span>
        <div className={styles.links}>
          <a href="/console">Console</a>
          <a href="https://github.com/samuelkahessay/prd-to-prod">GitHub</a>
        </div>
      </nav>

      <Hero />

      <hr className={styles.divider} />
      <HowItWorks />

      <hr className={styles.divider} />
      <ContrastList />

      <hr className={styles.divider} />
      <EvidenceLedger rows={evidence} />

      <hr className={styles.divider} />
      <BottomCta />
    </main>
  );
}
```

Create `web/app/page.module.css` with the page-level layout styles (nav, dividers, spacing matching the expressive register).

- [ ] **Step 7: Verify landing page renders**

```bash
cd web && npm run dev
```

Open http://localhost:3001. Verify:
- Hero renders with correct copy and type scale
- How it works shows 3 columns with BLOCKED example in Recover
- Contrast list shows NOT/IS pairs
- Evidence ledger shows data (or fallback if no GitHub token)
- Cream background, DM Sans, no border-radius

- [ ] **Step 8: Commit**

```bash
git add web/app/ web/components/landing/
git commit -m "feat(web): build landing page with all sections"
```

---

## Chunk 4: Console UI

### Task 10: Console Layout and Nav

**Files:**
- Create: `web/app/console/layout.tsx`
- Create: `web/components/console/console-nav.tsx`
- Create: `web/components/console/console-nav.module.css`

- [ ] **Step 1: Create console nav component**

Create `web/components/console/console-nav.tsx` and its CSS module.

Compact tab bar with Launch / Runs / Queue tabs, queue badge count, pipeline health status. Uses the functional register (tighter type scale, denser spacing).

Reference: `console-structure.html` lines 210-235

The nav uses Next.js `usePathname()` for active tab highlighting and `Link` for navigation.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./console-nav.module.css";

interface ConsoleNavProps {
  queueCount: number;
  pipelineHealthy: boolean;
}

export function ConsoleNav({ queueCount, pipelineHealthy }: ConsoleNavProps) {
  const pathname = usePathname();

  const tabs = [
    { label: "Launch", href: "/console" },
    { label: "Runs", href: "/console/runs" },
    { label: "Queue", href: "/console/queue", badge: queueCount },
  ];

  return (
    <nav className={styles.nav}>
      <span className={styles.logo}>
        <strong>prd-to-prod</strong> / console
      </span>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${
              pathname === tab.href ? styles.active : ""
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className={styles.badge}>{tab.badge}</span>
            ) : null}
          </Link>
        ))}
      </div>
      <div className={styles.spacer} />
      <div
        className={`${styles.statusDot} ${
          pipelineHealthy ? styles.ok : styles.warn
        }`}
      />
      <span className={styles.statusText}>
        {pipelineHealthy ? "pipeline healthy" : "pipeline degraded"}
      </span>
    </nav>
  );
}
```

- [ ] **Step 2: Create console layout**

Create `web/app/console/layout.tsx`:

```tsx
import { ConsoleNav } from "@/components/console/console-nav";
import { api } from "@/lib/api";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch queue count and preflight for nav
  // These are fetched server-side on each request
  let queueCount = 0;
  let pipelineHealthy = true;

  try {
    const queue = await api.getQueue();
    queueCount = queue.length;
    const checks = await api.preflight();
    pipelineHealthy = checks.filter((c) => c.required).every((c) => c.present);
  } catch {
    // API unavailable — show degraded state
    pipelineHealthy = false;
  }

  return (
    <>
      <ConsoleNav queueCount={queueCount} pipelineHealthy={pipelineHealthy} />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 32 }}>
        {children}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create placeholder console page**

Create `web/app/console/page.tsx`:

```tsx
export default function ConsolePage() {
  return <p>Console — under construction</p>;
}
```

- [ ] **Step 4: Verify console layout renders**

Start both servers:

```bash
cd console && node server.js &
cd web && npm run dev
```

Open http://localhost:3001/console. Verify the nav bar renders with tabs, logo, and pipeline status.

- [ ] **Step 5: Commit**

```bash
git add web/app/console/ web/components/console/
git commit -m "feat(web): add console layout with nav"
```

---

### Task 11: Console Main Page — Launch + Queue + Runs

**Files:**
- Modify: `web/app/console/page.tsx`
- Create: `web/components/console/launch-form.tsx`
- Create: `web/components/console/preflight-panel.tsx`
- Create: `web/components/console/queue-panel.tsx`
- Create: `web/components/console/runs-table.tsx`
- Create CSS modules for each

- [ ] **Step 1: Create launch form component**

Create `web/components/console/launch-form.tsx` and CSS module.

Client component (`"use client"`) with:
- Toggle: Raw notes / WorkIQ query
- Textarea for input
- Toggle: New product / Existing product
- Conditional target repo field
- Mock mode checkbox
- Start run button that calls `api.startRun()`

Reference: `console-structure.html` lines 244-287

- [ ] **Step 2: Create preflight panel component**

Create `web/components/console/preflight-panel.tsx` and CSS module.

Receives preflight checks as props. Shows green/warn/off dots with labels and version values.

Reference: `console-structure.html` lines 290-315

- [ ] **Step 3: Create queue panel component**

Create `web/components/console/queue-panel.tsx` and CSS module.

Client component that:
- Shows pending human actions with Approve/Reject buttons
- Each item: event description, policy reason, time waiting, run reference
- Visually interrupts the page flow — stronger urgency treatment (heal-colored top border, slightly elevated background)
- Calls `api.resolveQueueItem()` on button click

Reference: `console-structure.html` lines 318-348

Per spec refinement: queue gets stronger urgency hierarchy than other sections.

- [ ] **Step 4: Create runs table component**

Create `web/components/console/runs-table.tsx` and CSS module.

Tabular ledger with columns: # / Title / Started / Duration / Status.
- Color-coded status dots
- Issue refs in mono
- Active run highlighted
- Rows link to `/console/runs/[id]`

Reference: `console-structure.html` lines 351-395

- [ ] **Step 5: Assemble console main page**

Update `web/app/console/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { LaunchForm } from "@/components/console/launch-form";
import { PreflightPanel } from "@/components/console/preflight-panel";
import { QueuePanel } from "@/components/console/queue-panel";
import { RunsTable } from "@/components/console/runs-table";
import { api } from "@/lib/api";
import type { PreflightCheck, QueueItem, Run } from "@/lib/types";
import styles from "./page.module.css";

export default function ConsolePage() {
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    api.preflight().then(setChecks).catch(console.error);
    api.getQueue().then(setQueue).catch(console.error);
    api.listRuns().then(setRuns).catch(console.error);
  }, []);

  return (
    <div className={styles.consolePage}>
      <div className={styles.launchPanel}>
        <LaunchForm />
        <PreflightPanel checks={checks} />
      </div>

      {queue.length > 0 && (
        <QueuePanel items={queue} onResolve={(id, resolution) => {
          api.resolveQueueItem(id, resolution).then(() => {
            api.getQueue().then(setQueue);
          });
        }} />
      )}

      <RunsTable runs={runs} />
    </div>
  );
}
```

Create `web/app/console/page.module.css` with the two-column launch panel grid (form + preflight sidebar) matching `console-structure.html` layout.

- [ ] **Step 6: Verify console page renders**

Start both servers, open http://localhost:3001/console. Verify:
- Launch form with toggles and textarea
- Preflight checks sidebar
- Queue panel (empty or with items)
- Runs table (empty or with data)

- [ ] **Step 7: Commit**

```bash
git add web/app/console/ web/components/console/
git commit -m "feat(web): build console main page with launch, queue, and runs"
```

---

## Chunk 5: Run Detail + Cleanup

### Task 12: Run Detail Page

**Files:**
- Create: `web/app/console/runs/[id]/page.tsx`
- Create: `web/components/console/stage-track.tsx`
- Create: `web/components/console/decision-trail.tsx`
- Create: `web/components/console/artifacts-list.tsx`
- Create CSS modules for each

- [ ] **Step 1: Create stage track component**

Create `web/components/console/stage-track.tsx` and CSS module.

5-stage horizontal strip: Extract → Build → Review → Policy → Deploy.
Each stage has a colored top border and state label. States: done (green), active (blue), blocked (orange), pending (gray). Blocked stages get a wash background.

Reference: `console-structure.html` lines 400-420

The component receives the run's events and derives stage states using the mapping from the spec (lines 228-234):
- Extract/Build = from orchestrator events
- Review = from events with PR/review refs
- Policy = from `blocked`/`human` type events
- Deploy = from merge/deploy events

```tsx
import type { RunEvent, StageStatus } from "@/lib/types";
import styles from "./stage-track.module.css";

function deriveStages(events: RunEvent[]): StageStatus[] {
  const stages: StageStatus[] = [
    { name: "Extract", state: "pending", label: "" },
    { name: "Build", state: "pending", label: "" },
    { name: "Review", state: "pending", label: "" },
    { name: "Policy", state: "pending", label: "" },
    { name: "Deploy", state: "pending", label: "" },
  ];

  for (const event of events) {
    if (event.stage === "EXTRACT") {
      if (event.kind === "stage_complete") stages[0] = { ...stages[0], state: "done", label: "complete" };
      else if (event.kind === "stage_start") stages[0] = { ...stages[0], state: "active", label: "in progress" };
    }
    if (event.stage === "BUILD" || event.stage === "ANALYZE") {
      if (event.kind === "stage_complete") stages[1] = { ...stages[1], state: "done", label: "complete" };
      else if (event.kind === "stage_start") stages[1] = { ...stages[1], state: "active", label: "in progress" };
    }
    if (event.kind === "artifact" && event.data?.key === "tracking_issue_number") {
      stages[2] = { ...stages[2], state: "done", label: `PR opened` };
    }
    if (event.type === "blocked") {
      stages[3] = { ...stages[3], state: "blocked", label: event.data?.event || "policy gate" };
    }
    if (event.type === "human" && event.kind === "queue_resolved") {
      stages[3] = { ...stages[3], state: "done", label: event.data?.resolution || "resolved" };
    }
    if (event.kind === "run_complete") {
      stages[4] = { ...stages[4], state: "done", label: "deployed" };
    }
  }

  return stages;
}

export function StageTrack({ events }: { events: RunEvent[] }) {
  const stages = deriveStages(events);

  return (
    <div className={styles.track}>
      {stages.map((stage) => (
        <div key={stage.name} className={`${styles.stage} ${styles[stage.state]}`}>
          <div className={styles.name}>{stage.name}</div>
          <div className={styles.label}>{stage.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create decision trail component**

Create `web/components/console/decision-trail.tsx` and CSS module.

Timestamped audit entries with colored indicator dots. Dot colors: blue (auto), orange (blocked), purple (human), gray (system).

Reference: `console-structure.html` lines 425-468

- [ ] **Step 3: Create artifacts list component**

Create `web/components/console/artifacts-list.tsx` and CSS module.

Linked references to GitHub issue, PR, CI run, Vercel deploy, policy decision log.

Reference: `console-structure.html` lines 471-480

- [ ] **Step 4: Create run detail page**

Create `web/app/console/runs/[id]/page.tsx`:

```tsx
import { api } from "@/lib/api";
import { StageTrack } from "@/components/console/stage-track";
import { DecisionTrail } from "@/components/console/decision-trail";
import { ArtifactsList } from "@/components/console/artifacts-list";
import styles from "./page.module.css";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [run, decisions, audit] = await Promise.all([
    api.getRun(id),
    api.getDecisions(id),
    api.getAudit(id),
  ]);

  if (!run) {
    return <p>Run not found.</p>;
  }

  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <h2>
          Run #{run.id.slice(0, 4)} — {run.summary}
        </h2>
        <span className={styles.meta}>
          {run.status} · {run.mode} · started{" "}
          {new Date(run.createdAt).toLocaleString()}
        </span>
      </div>

      <StageTrack events={run.events || []} />

      <h3 className={styles.sectionLabel}>Decision trail</h3>
      <DecisionTrail entries={audit} />

      <h3 className={styles.sectionLabel}>Artifacts</h3>
      <ArtifactsList run={run} />
    </div>
  );
}
```

Create `web/app/console/runs/[id]/page.module.css` with run detail layout styles.

- [ ] **Step 5: Verify run detail page**

Start both servers. If there are existing runs, navigate to one via the runs table. If no runs exist, start a mock run first and then navigate. Verify:
- Stage track renders with colored borders
- Decision trail shows timestamped entries
- Artifacts show as linked references

- [ ] **Step 6: Commit**

```bash
git add web/app/console/runs/ web/components/console/stage-track.* web/components/console/decision-trail.* web/components/console/artifacts-list.*
git commit -m "feat(web): build run detail page with stage track, decisions, and artifacts"
```

---

### Task 13: Runs List Page

**Files:**
- Create: `web/app/console/runs/page.tsx`

- [ ] **Step 1: Create runs list page**

Create `web/app/console/runs/page.tsx`:

```tsx
import { api } from "@/lib/api";
import { RunsTable } from "@/components/console/runs-table";

export default async function RunsPage() {
  let runs = [];
  try {
    runs = await api.listRuns();
  } catch {
    // API unavailable
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
        All runs
      </h2>
      <RunsTable runs={runs} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/console/runs/page.tsx
git commit -m "feat(web): add runs list page"
```

---

### Task 14: Retire Old Console UI and Delete .NET Project

**Files:**
- Modify: `console/server.js`
- Delete: `console/public/` (all files)
- Delete: `console/routes/api-history.js`
- Delete: `PRDtoProd/` (entire directory)

- [ ] **Step 1: Remove static file serving from server.js**

In `console/server.js`, remove:
- `app.use(express.static(path.join(__dirname, "public")));`
- The `/run/:id` and `/history` catch-all routes

The Express server now only serves API routes. All UI is served by `web`.

- [ ] **Step 2: Delete old console frontend**

```bash
rm -rf console/public/
```

- [ ] **Step 3: Delete api-history.js**

```bash
rm console/routes/api-history.js
```

Remove the `registerHistoryRoutes` import from `server.js` if still present.

- [ ] **Step 4: Verify API still works without static files**

```bash
cd console && node server.js &
curl http://127.0.0.1:3000/api/preflight | jq .
curl http://127.0.0.1:3000/api/runs | jq .
kill %1
```

Expected: API endpoints return data. No static files served.

- [ ] **Step 5: Commit the console cleanup**

```bash
git add -A console/
git commit -m "refactor(console): retire vanilla UI, remove static file serving"
```

- [ ] **Step 6: Delete the .NET project**

```bash
rm -rf PRDtoProd/
```

- [ ] **Step 7: Commit .NET deletion**

```bash
git add -A PRDtoProd/
git commit -m "chore: delete .NET operator dashboard — replaced by web console"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Start both servers and verify end-to-end**

```bash
# Terminal 1: Express API
cd console && node server.js

# Terminal 2: Next.js frontend
cd web && npm run dev
```

Verify all success criteria from the spec:

1. ✅ Landing page at `/` — hero, how it works, contrast, evidence, CTA
2. ✅ Console at `/console` — launch form, queue, runs table
3. ✅ Queue items are first-class — visible on console main page
4. ✅ Run detail at `/console/runs/[id]` — stage track, decision trail, artifacts
5. ✅ Single frontend codebase (`web/`), single API (`console/`)
6. ✅ No `PRDtoProd/` directory
7. ✅ No `console/public/` directory
8. ✅ API routes respond at `/api/*` via Next.js rewrites

- [ ] **Step 2: Run tests**

```bash
cd console && npx jest --verbose
```

Expected: All tests pass.

- [ ] **Step 3: Final commit**

If any cleanup is needed, commit it:

```bash
git add -A
git commit -m "chore: final cleanup for console productization"
```
