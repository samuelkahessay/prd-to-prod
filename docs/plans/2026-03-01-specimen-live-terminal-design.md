# Specimen App: Live Terminal Redesign

## Context

The Ticket Deflection Service specimen app currently splits across three pages (`/dashboard`, `/tickets`, `/activity`). This creates a fragmented demo experience — visitors click "Run Demo," get redirected to a static dashboard, and have to navigate between pages to see the full picture. The pages were built before the pipeline/specimen narrative separation (#238, #240) and feel disconnected.

The specimen should demonstrate that the prd-to-prod pipeline builds *real software*. The best way to prove that is letting visitors interact with it directly — submit a ticket, watch it get processed step by step, see the result.

## Goal

Replace the 3-page specimen with a single unified page centered on **interactive ticket submission with live processing animation**. A visitor should be able to type a support ticket (or click "Random"), watch the classification/matching/resolution pipeline fire in real-time, and see metrics update live. One page, one interaction, one takeaway: "this pipeline builds real software."

## Design

### Page Architecture

Single page at `/dashboard`. Three vertically stacked zones:

```
┌──────────────────────────────────────────────────────┐
│ TICKET DEFLECTION SERVICE                ◀ prd-to-prod│
├──────────────────────────────────────────────────────┤
│                                                      │
│  METRICS BAR                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Total: 12│  │ Defl: 83%│  │ Esc: 2   │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                      │
│  SUBMIT + LIVE PROCESSING                            │
│  ┌──────────────────────────────────────────┐        │
│  │ Title: [________________________]        │        │
│  │ Desc:  [________________________]        │        │
│  │        [ Submit ]  [ Random ]            │        │
│  │                                          │        │
│  │ ▸ INTAKE    Ticket created               │        │
│  │ ▸ CLASSIFY  AccountIssue / High          │        │
│  │ ▸ MATCH     "Password Reset Guide" 0.82  │        │
│  │ ▸ RESOLVE   Auto-resolved                │        │
│  │                                          │        │
│  │ Resolution: "To reset your password..."  │        │
│  │                     [ Submit Another ]    │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  TICKET FEED                                         │
│  ┌──────────────────────────────────────────┐        │
│  │ #a3f2  "Password not working"   RESOLVED │        │
│  │ #b7c1  "App crashes on start"   RESOLVED │        │
│  │ #d4e8  "Add dark mode"         ESCALATED │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  Built by prd-to-prod                                │
└──────────────────────────────────────────────────────┘
```

### Zone 1: Metrics Bar

Compact horizontal row. Three metrics: Total Tickets, Deflection Rate, Escalated. Updates live after every ticket submission (no refresh button). Same data source as current dashboard (`/api/metrics/overview`).

The category/severity doughnut charts from the current dashboard are dropped. Three numbers tell the story for a demo. Charts add visual noise without aiding comprehension for a first-time visitor.

### Zone 2: Submit + Live Processing

The centerpiece. Two interaction modes:

**Input mode:**
- Title text field + Description textarea
- Two buttons:
  - `[ Submit ]` — process the visitor's input
  - `[ Random ]` — pick a random sample ticket, auto-fill fields, auto-submit. This is the low-friction "show me" path.
- Terminal-style panel framing (matches existing aesthetic)

**Processing mode** (replaces input area after submit):
- Single API call to `POST /api/tickets/submit` with `{Title, Description, Source: "web"}`
- Response contains everything: ticket, classification, match result (article + score), activity logs
- Frontend reveals stages sequentially with ~500ms delays:
  ```
  ▸ INTAKE    Ticket created
  ▸ CLASSIFY  AccountIssue / High
  ▸ MATCH     "Password Reset Guide" (0.82)
  ▸ RESOLVE   Auto-resolved
  ```
- After all stages revealed, show the resolution text (KB article snippet for auto-resolved, or "No matching article — escalated to human review" for escalated tickets)
- `[ Submit Another ]` button resets to input mode

**Pacing:** The backend processes in <2s. The staged reveal is client-side animation only — the API call returns immediately, and JS reveals each line with delays. Not faking server latency; pacing the UX for comprehension.

**Random ticket source:** The `SimulateEndpoints.SampleTickets` array has 23 curated samples. The Random button picks one at random, fills the form (so the visitor sees what's being submitted), and auto-submits after a brief pause (~300ms). This lets visitors rapid-fire through examples.

### Zone 3: Ticket Feed

Scrollable list of all processed tickets, most recent first. Each row: short ID (first 4 chars of GUID), title, status tag (AUTO_RESOLVED / ESCALATED), category. Loads from `/api/metrics/tickets` on page load.

New tickets submitted through Zone 2 get prepended to the feed immediately from the submit response data — no API re-fetch needed for the newly added ticket.

Feed shows the 20 most recent tickets. No pagination — this is a demo, not a data browser.

### Status Bar

Carries forward the Ticket Deflection Service branding from #240:
```
TICKET DEFLECTION SERVICE                               ◀ prd-to-prod
```
Navigation links to `/tickets` and `/activity` are removed from the status bar since those pages no longer exist as separate destinations.

### What Happens to Old Pages

`/tickets` and `/activity` redirect to `/dashboard` (server-side redirect). This avoids breaking bookmarks, cached landing page HTML, or any external links.

### Landing Page Updates

The specimen section on Index.cshtml currently has 3 nav links (`/dashboard`, `/tickets`, `/activity`). These reduce to a single CTA pointing to `/dashboard`. The demo button behavior changes:
- Currently: `POST /api/simulate?count=25` then redirect to `/dashboard`
- New: redirect to `/dashboard` directly (the page itself is interactive — no need to pre-seed)

Alternatively, the demo button could redirect to `/dashboard` with a query param (e.g., `?demo=1`) that auto-triggers a Random ticket submission on load, giving the visitor an immediate taste of the processing animation.

## Issue Sequencing

### Issue 1: Unified specimen page with interactive ticket submission

The primary build. Rebuild `/dashboard` as the single-page specimen:
- Metrics bar (compact, live-updating)
- Interactive submission form with Random button
- Live processing animation (client-side staged reveal from submit API response)
- Ticket feed (recent tickets, prepend on submit)
- Status bar updated (remove /tickets and /activity nav links)

Files: `Dashboard.cshtml` (full rewrite), potentially `Dashboard.cshtml.cs` if the page model needs changes.

### Issue 2: Remove old pages, update landing page

Depends on Issue 1.
- `/tickets` redirects to `/dashboard`
- `/activity` redirects to `/dashboard`
- Landing page specimen section: 3 nav links → single CTA
- Landing page demo button: updated behavior (direct link or ?demo=1)

Files: `Tickets.cshtml`, `Activity.cshtml` (replaced with redirects), `Index.cshtml` (specimen section update).

### Issue 3 (optional): Polish

- Ticket feed row expand/collapse to show processing details
- Keyboard shortcut (Enter to submit, R for random)
- Auto-seed a few tickets on first load so the page isn't empty
- Any rough edges surfaced by Issues 1-2

## Technical Notes

- The `/api/tickets/submit` endpoint already returns everything needed: ticket data, classification, match result with score, and activity logs. No new API endpoints required for Issue 1.
- The 23 sample tickets in `SimulateEndpoints.SampleTickets` are the source for the Random button. These could be exposed via a lightweight GET endpoint, or hardcoded in the JS (they're static strings). A new `GET /api/tickets/samples` endpoint would be cleaner.
- The in-memory database seeds 25 demo tickets on startup (when `DemoSeed:Enabled` is true). This means the feed won't be empty on first load in production. In development or after a restart, the seeded tickets populate Zone 3.
- The doughnut charts (Chart.js) are no longer needed. The Chart.js CDN dependency can be removed from the page.

## Anti-Slop Rules (for all issues)

- No emoji characters
- No rounded pill buttons or tab bars
- No gradient text effects
- No loading spinners — use terminal-style text ("processing...", "classifying...")
- No marketing language
- No new font families, icon libraries, or CSS frameworks
- Processing animation should feel like terminal output, not a progress bar or stepper component
- The Random button should not feel like a game or toy — it's a demo tool

## Out of Scope

- No authentication or user sessions
- No persistent database migration
- No changes to the classification or matching algorithms
- No mobile-specific layout (responsive is fine, mobile-optimized UX is not in scope)
- No changes to the API layer beyond potentially adding a sample tickets endpoint
- No changes to `.github/workflows/`
