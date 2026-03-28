# Console Productization Design

**Date:** 2026-03-11
**Status:** Design approved, pending implementation plan
**Mockups:** `.superpowers/brainstorm/53633-1773285939/` (landing-v2.html, console-structure.html)

## Problem

prd-to-prod has two separate web stacks serving overlapping purposes: a .NET operator dashboard (`PRDtoProd/`) deployed to Azure and a Node/Express console (`console/`) serving static HTML. There is no landing page that communicates what the product is. Visitors encounter either a launch form or a compliance dashboard — neither tells the full story.

The product needs a single, coherent web presence that separates the public pitch from the operator tool, consolidates both existing stacks, and makes the human control boundary — the product's core differentiator — tangible and inspectable.

## Solution

Two surfaces, one frontend, shared design language.

### Architecture

```
web/  (Next.js 15 + React 19)
├── /              Landing page (SSG)
├── /console       Operator console (dynamic)
├── /console/runs         Run history
└── /console/runs/[id]    Deep run detail

console/  (Express API — persistent Node process)
├── GET  /api/preflight
├── POST /api/run
├── GET  /api/run/:id           (run detail)
├── GET  /api/run/:id/stream    (SSE)
├── GET  /api/runs              (list — renamed from /api/history)
├── GET  /api/queue             (new)
├── GET  /api/run/:id/decisions (new)
├── GET  /api/run/:id/audit     (new)
└── POST /api/queue/:id/resolve (new)

DELETE after migration:
├── PRDtoProd/          (.NET project)
└── console/public/     (vanilla HTML/CSS/JS UI)
```

**Key constraints:**
- `web` is the canonical frontend. All UI lives here.
- `console` remains as the persistent Node API/orchestrator. SSE + SQLite requires a long-lived process.
- API route shape is normalized to resource-first: `/api/run/:id/stream` (not `/api/run/stream/:id`), `/api/runs` (not `/api/history`). Existing `POST /api/run` keeps its shape. Preflight remains `GET /api/preflight` to match the current implementation.
- One public domain. In dev: Next.js rewrites in `next.config.js` proxy `/api/*` to Express on `:3000`. In production: reverse proxy or Vercel rewrites route `/api/*` to the persistent Node host. The Express API must not be forced into Vercel serverless — SSE + SQLite requires a long-lived process.
- Shared design tokens live in `web`, not as cross-project raw CSS.
- `/` is public. `/console/*` and all `/api/*` endpoints are operator-authenticated. The console is an operator surface, not a public dashboard. Public proof for the landing page comes from build-time GitHub data, not from exposing the console API anonymously.

### Migration order

1. Build `web` with landing page (`/`) and console routes (`/console/*`)
2. Wire `web` to existing Express API endpoints
3. Add new API endpoints (queue, decisions, audit)
4. Reach feature parity with `console/public/` and retire it
5. Delete `PRDtoProd/` after replacement is complete

## Surface 1: Landing Page (`/`)

**Job:** Make someone understand three things in 30 seconds — what it is, why it matters, why to believe it.

**Register:** Expressive — larger type scale, more negative space, dramatic composition, stronger motion, asymmetric pacing. This is the manifesto.

### Sections

**Hero**
- Left-aligned, asymmetric two-column layout
- Headline: "Brief in. / Production out." — weight 900 for first line, 300 italic for second
- Type scale: `clamp(52px, 6.5vw, 88px)`
- Subtitle: "Turns PRDs and meeting notes into reviewed, merged, deployed code. Agents build. Policy gates enforce. The system heals itself."
- Primary CTA: "See it run" (solid, square corners)
- Secondary: "Open console →" (text link)
- Right column: pipeline animation (5-act narrative) or system artifact — must be real, not a placeholder

**01 — How it works**
- Three columns: Plan / Implement / Recover
- Third column (Recover) gets 1.4x width, left border, heal-colored top rule — this is the moat
- Concrete policy boundary example inside the Recover step: `BLOCKED deploy to production / policy: requires human approval / owner: operator@team`
- Recover step makes the trust model tangible, not abstract

**02 — Why this is different**
- NOT/IS contrast list (not a grid of cards)
- "Not" rows in muted text, "Is" rows in weighted text
- Four contrasts: not a chatbot / not one-shot / not ungoverned / not a demo
- Flat list layout — reads fast, no container noise

**03 — Evidence**
- Ledger format with column headers: Time / Event / Duration / Outcome
- Real timestamps, issue/PR refs in mono, color-coded outcomes
- Outcome states: `● running` (blue), `● merged` (green), `● healed` (orange), `● blocked` (orange), `○ drill` (gray)
- At least one "live" row with inspectable affordance
- Drills labeled honestly as verification runs
- Footer: "Showing N of M events · View full activity → · Open on GitHub →"
- Must look like reading from a live system, not marketing furniture

**Bottom CTA**
- Left-aligned, not centered
- "Open console" primary + "View on GitHub →" text link

### Landing page refinements (carry into implementation)
- Animation panel must be a real artifact or reduce its dominance — placeholder will look fake against the operational proof section
- Nav should be simpler than generic site chrome — or pushed down
- Ledger rows should feel inspectable — linked refs, hover affordances

## Surface 2: Console (`/console`)

**Job:** Prove the control. This is the operator instrument panel.

**Register:** Functional — tighter rhythm, denser information, stronger alignment, quieter motion, clear state signaling. Operational emphasis over spectacle.

**IA rule:** "What needs me now?" before "What happened before?"

### Nav

Compact tab bar: `Launch | Runs | Queue`
- Queue tab shows badge count when items are pending
- Pipeline health status indicator on the right (dot + "pipeline healthy")
- Logo: `prd-to-prod / console`

### First layer — default view

**Launch**
- Input form with toggle: Raw notes / WorkIQ query
- Pipeline mode toggle: New product / Existing product
- Existing product mode shows target repo field (conditional)
- Mock mode checkbox
- "Start run" button
- Preflight checks in right sidebar: 5 items (GitHub CLI, gh-aw, Copilot, Self-heal, Vercel) with green/warn/off dots and version strings

**Queue (first-class, not buried)**
- Pending human actions with Approve/Reject buttons
- Each item shows: event description, policy reason, time waiting, run reference
- Must visually interrupt the normal page flow — stronger urgency treatment than other sections
- Appears above run history when items are pending

**Runs**
- Tabular ledger: # / Title / Started / Duration / Status
- Color-coded status: running (blue), complete (green), healed (orange), failed (red)
- Issue refs in mono
- Active run gets subtle background highlight
- Rows are clickable → navigate to run detail

### Second layer — run detail (`/console/runs/[id]`)

**Run detail is a separate page, not an inline panel.** It only appears when a run is selected — not always present at full weight on the default view.

**Header:** Run title + metadata (issue ref, PR ref, duration, outcome)

**Stage track:** 5-stage horizontal strip: Extract → Build → Review → Policy → Deploy
- Each stage has a colored top border and state label
- States: done (green), active (blue), blocked (orange), pending (gray)
- Blocked stages get a wash background for emphasis

**Decision trail:** Timestamped audit entries with colored indicator dots
- Dot colors: blue (autonomous), orange (blocked), purple (human decision), gray (system event)
- Each entry is a concrete event with refs: "CI failure detected", "Auto-created issue #339", "Deploy gate — BLOCKED", "Operator approved"
- BLOCKED tag is visually prominent — impossible to miss
- Policy references link to the actual policy rule

**Artifacts:** Linked references to external resources
- Issue, PR, CI run, Vercel deploy, policy decision log
- All link to actual GitHub/Vercel URLs

### Console refinements (carry into implementation)
- Queue needs stronger urgency hierarchy — should visually interrupt, not sit at same weight
- Run detail is contextual to selected run, never always-present
- Default view optimizes for "what needs me now?" — queue and active runs above history

## Visual Design System

### Shared foundation (both surfaces)

**Typography:**
- Display + body: DM Sans (weights 300, 400, 500, 600, 700, 900)
- Mono (status values, timestamps, refs): JetBrains Mono (weights 400, 500)

**Color palette (oklch):**
- Background: `oklch(97.5% 0.004 75)` — cream
- Ink: `oklch(16% 0.01 55)` — near-black brown
- Ink mid: `oklch(35% 0.01 55)`
- Ink muted: `oklch(50% 0.01 55)`
- Ink faint: `oklch(70% 0.008 55)`
- Accent (blue): `oklch(56% 0.1 255)`
- Good (green): `oklch(48% 0.12 155)`
- Heal (orange): `oklch(50% 0.14 30)`
- Policy (purple): `oklch(52% 0.12 300)`
- Rule: `oklch(88% 0.008 75)`

**Shared traits:**
- Square corners throughout (no border-radius on buttons/inputs)
- No cards, no shadows — hierarchy through weight, spacing, hairline rules
- Same brand attitude: serious, designed, inspectable

### Register split

**Landing page (expressive):**
- Type scale: 88px → 36px → 20px → 17px → 15px → 13px → 11px
- Generous negative space (80-120px section gaps)
- Asymmetric layouts, left-aligned hero
- Animation and motion for narrative moments
- Weight contrast: 900 paired with 300

**Console (functional):**
- Type scale: 22px → 14px → 13px → 12px → 11px (tighter range)
- Compact spacing (32-48px section gaps)
- Grid-aligned, scannable layouts
- Minimal motion — state changes only
- Weight contrast: 700 paired with 400

## Data Model Changes

The current event store is an in-memory Map keyed by run ID. It stores timestamped events emitted by the orchestrator but has no concept of decisions, queue items, or blocked states. The new operator features require extending this model.

**Event store extensions:**
- Each event gains a `type` field: `system`, `auto`, `blocked`, `human`. Currently all events are untyped log entries.
- New event type `blocked` is emitted when the orchestrator encounters a policy gate. The orchestrator already has hook points where stage transitions happen — blocked events are emitted at these points when a policy rule matches.
- New event type `human` is emitted when an operator resolves a queued action via `POST /api/queue/:id/resolve`.
- Each `blocked` event creates a durable queue item record. `GET /api/queue` reads pending items from `queue_items`, joined back to the source run/event metadata for display.

**Persistence:** The current in-memory Map must be replaced with SQLite-backed persistence. The `console/data/` directory exists (currently stores `history.json`), but SQLite is not yet a dependency — it must be installed (e.g., `better-sqlite3`). Queue items and audit trails must survive process restarts.

**Storage shape:**
- `runs` table: stable run metadata (`id`, timestamps, mode, summary, status)
- `run_events` table: append-only event log with stable `id`, `run_id`, `timestamp`, `stage`, `type`, payload JSON
- `queue_items` table: durable records created when a `blocked` event is emitted; fields include `id`, `run_id`, `source_event_id`, `policy_rule`, `status`, `queued_at`, `resolved_at`, `resolved_by`, `resolution`

Queue items are not derived ad hoc on every read. A blocked decision creates one durable queue record with its own stable ID. This ID is the resource identifier used by `POST /api/queue/:id/resolve`.

**Stage mapping:** The orchestrator currently tracks 3 stages (Extract, Analyze, Build). The UI displays 5 stages (Extract, Build, Review, Policy, Deploy). The mapping is:
- Extract = orchestrator's EXTRACT stage
- Build = orchestrator's BUILD stage (Analyze is folded in as a sub-step)
- Review = explicit backend-enriched events from PR/review workflow activity
- Policy = explicit backend events emitted when a policy gate blocks or when a queued action is resolved
- Deploy = explicit backend-enriched events from merge/deploy confirmations

The stage track is still a UI projection, but it requires additional backend enrichment. The frontend does not invent review, policy, or deploy states from generic logs.

**Backend enrichment requirements:**
- The Express layer must append typed events beyond the current shell progress stream.
- Review events are sourced from GitHub PR/review state linked to the run's issue/PR refs.
- Policy events are emitted when the orchestrator or policy evaluator blocks an action, and when an operator approves/rejects it.
- Deploy events are sourced from merge/deploy confirmations (for example, merge completion plus deployment status/webhook confirmation).
- If a data source is unavailable, the run detail must show that stage as unknown/pending rather than fabricating certainty.

**Authentication:** Authentication is required for the entire operator surface, not only decision mutations. The Express server sets an operator session cookie after a lightweight login. All `/console/*` routes and all `/api/*` endpoints require that session cookie. `POST /api/run` and `POST /api/queue/:id/resolve` return 401 if no session is present. Full auth design (provider, session storage, token rotation) is deferred to a follow-up spec — this spec defines the enforcement boundary only: the landing page is public; the console and console API are not.

## API Changes

**Renamed endpoints:**
- `GET /api/history` → `GET /api/runs` (resource-consistent naming)

Note: `GET /api/run/:id/stream` is already the current shape — no rename needed.

**New endpoints:**

**`GET /api/queue`**
Returns pending human actions across all runs.
```json
[{
  "id": "...",
  "runId": "...",
  "event": "Deploy to production",
  "ref": "PR #342",
  "reason": "Policy: production deploys require operator approval",
  "policyRule": "autonomy-policy.yml#deploy-gate",
  "queuedAt": "2026-03-11T14:26:00Z"
}]
```

**`GET /api/run/:id/decisions`**
Returns decision events for a specific run.
```json
[{
  "timestamp": "2026-03-11T09:24:02Z",
  "type": "blocked",
  "event": "Deploy gate",
  "detail": "Production deploy requires operator approval",
  "policyRef": "autonomy-policy.yml#deploy-gate",
  "resolvedBy": "operator@team",
  "resolvedAt": "2026-03-11T09:25:41Z",
  "resolution": "approved"
}]
```

**`POST /api/queue/:id/resolve`**
Resolve a queued action. Requires authenticated operator (cookie-based session). Valid `resolution` values: `"approved"` or `"rejected"`.

Request body:
```json
{
  "resolution": "approved"
}
```

`operatorId` is derived server-side from the session cookie, not supplied in the request body.

Queue resolution semantics:
- `:id` is the durable `queue_items.id`, not a derived run/event composite.
- First successful resolution wins and stamps `resolvedAt`, `resolvedBy`, and `resolution`.
- Repeating the same resolution for an already-resolved item is idempotent and returns the existing resolved record.
- Submitting a conflicting resolution for an already-resolved item returns `409 Conflict`.
- Resolving an item emits a corresponding `human` event into `run_events`.

**`GET /api/run/:id/audit`**
Returns the full timestamped audit trail for a run.
```json
[{
  "timestamp": "2026-03-11T09:18:04Z",
  "type": "system",
  "event": "CI failure detected",
  "detail": "Lint rule violation in console.css:142",
  "ref": null
}]
```

## .NET Feature Replacement Mapping

The .NET project (`PRDtoProd/`) has several pages and endpoints. Here is what carries forward and what is dropped:

**Carried forward (absorbed into console):**
- Operator dashboard metrics (autonomous acted, blocked, queued, escalated) → derived from event store, shown in run detail
- Blocked actions list → Queue tab
- Human queue (waiting on operator) → Queue tab with approve/reject
- Decision ledger → Run detail decision trail
- Past runs with stage dots → Runs tab

**Dropped (not needed):**
- Compliance page (static policy documentation) — policy rules are referenced inline in decision trail entries
- Activity page (generic event log) — replaced by the more structured audit trail per run
- Tickets page (issue listing) — GitHub is the source of truth; link to it directly
- Pipeline page (workflow status) — replaced by preflight checks + run status
- Standalone metrics dashboard — metrics are contextual to runs, not a separate view
- All .NET API endpoints (autonomy, compliance, pipeline, metrics) — replaced by Express API
- Azure deployment configuration

**Key principle:** The .NET project tried to be a standalone compliance dashboard. The new console absorbs the *useful* parts (decisions, blocked actions, audit trail) into the run context where they belong, and drops the rest.

## Landing Page Data Source

The Evidence section on `/` requires real pipeline activity data. Data strategy:

- **Build time (SSG):** At `next build`, a data-fetching step calls the GitHub API to get recent issues, PRs, and workflow runs for the repo. This produces a static JSON snapshot embedded in the page. No dependency on the Express API for the landing page.
- **Staleness:** Acceptable. The landing page rebuilds on each deploy (which happens via the pipeline itself). Evidence is at most one deploy cycle stale.
- **Drill labeling:** The build-time fetch checks for the `drill` label on issues and marks those rows as `○ drill` in the ledger.
- **Fallback:** If the GitHub API is unreachable at build time, the page renders with a "Recent activity unavailable" message instead of an empty or broken ledger.

## Auth boundary

- Public: `/`
- Operator-only: `/console`, `/console/runs`, `/console/runs/[id]`, all `/api/*`
- The landing page must never depend on unauthenticated access to operator APIs for proof data.

## What Gets Deleted

- `PRDtoProd/` — entire .NET project (after `web` replaces its functionality per the mapping above)
- `console/public/` — vanilla HTML/CSS/JS frontend (after `web` reaches feature parity)
- Any Azure deployment configuration for the .NET app

## What stays

- `console/server.js` and `console/lib/` — Express API, event store, orchestrator
- `console/routes/` — existing API routes (refactored for normalized route shapes)
- `console/data/` — SQLite persistence
- `scripts/` — operational scripts
- `.github/workflows/` — pipeline infrastructure

## Success criteria

1. Landing page at `/` communicates what prd-to-prod is in 30 seconds
2. Console at `/console` replaces both the old console UI and the .NET operator dashboard
3. Queue items and policy boundaries are first-class, not buried
4. Decision trail is inspectable per run with timestamps, refs, and artifact links
5. Single frontend codebase (`web`), single API (`console`), no .NET dependency
6. Proof section on landing page shows real pipeline activity, not static marketing copy
7. Drills are labeled honestly as verification runs
8. Both surfaces share visual tokens but operate at different registers
