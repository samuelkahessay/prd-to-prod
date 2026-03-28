# Showcase Gallery — Design Spec

**Date**: 2026-03-18
**Status**: Approved

## Problem

The repo has 5 apps built autonomously by the pipeline (tags v1.0.0–v5.0.0) but they're buried in git history with no way for visitors to see, interact with, or understand them. The README lists them as a table. Branches and tags are messy. There's no visual proof that the pipeline ships real software.

## Solution

A three-layer showcase system:

1. **Landing page carousel strip** — teaser on the home page
2. **`/showcase` gallery page** — dedicated browsable gallery
3. **`/showcase/[slug]` app pages** — functional replicas visitors can use

Each of the 5 apps gets ported to Next.js (the two ASP.NET apps are re-implemented) and serves as a fully functional application using browser localStorage for persistence.

## Layer 1: Landing Page Carousel Strip

**Placement**: Between "What You Get" and "How It Works" sections.

**Section heading**: "Built by the pipeline" with subtitle: "5 apps. 5 PRDs. Each one autonomously decomposed, implemented, reviewed, and merged."

**Cards** (6 total — 5 apps + 1 CTA):

Each app card shows:
- Run number (e.g., "Run 01")
- App name
- One-line description
- Tech stack badge (original stack for native Next.js apps, "ASP.NET → Next.js" for ported apps)
- Pipeline stats (issues, PRs, and optionally a third metric like tests/themes/lines)
- Date
- "Try it live →" link

CTA card (6th):
- "Your PRD could be next" headline
- "Send us a product spec. Get back a deployed app." subtitle
- "Get started →" button linking to /build
- Dashed border to visually distinguish from app cards

**Behavior**:
- Horizontally scrollable (drag or scroll), no auto-scroll
- Cards are ~300px wide, 2-3 visible at a time on desktop
- Scroll-snap to card boundaries
- Single card width on mobile, swipeable
- "See all →" link at section level pointing to /showcase

## Layer 2: /showcase Gallery Page

**Layout**: 2-column responsive grid (1-column on mobile).

**Header**: "Built by the pipeline" heading with explanatory subtitle about the autonomous process.

**Each card includes**:
- Preview area (180px tall) — static screenshots of each app's landing state. Implementation must create `web/public/showcase/` and capture a screenshot per app after each app is built
- Run number and app name
- Tech stack badge ("Originally ASP.NET + C#" for ported apps)
- One-line description
- Pipeline stats (issues, PRs, and notable metrics)
- Two actions: "Open app →" (goes to /showcase/[slug]) and "View PRD" (links to the PRD file on GitHub at the tagged commit, e.g., `github.com/samuelkahessay/prd-to-prod/blob/v4.0.0/docs/prd/ticket-deflection-prd.md`)

**CTA at bottom**: "Your PRD could be next" card with dashed border, same treatment as carousel CTA. Links to /build.

## Layer 3: /showcase/[slug] App Pages

**Layout**: Split view with fixed sidebar.

**Sidebar (260px fixed width)**:
- "← Back to showcase" link
- App name
- Tech stack badge (with "Originally ASP.NET + C#" for ported apps)
- One-line description
- Pipeline stats section: issues decomposed, PRs merged, lines added, files changed
- "View PRD →" link (links to PRD on GitHub at the tagged commit)

**Main area**: The functional app renders here, filling remaining viewport width and full height.

**Mobile**: Sidebar collapses to a fixed top bar showing app name, badge, and a "Details" toggle that expands the full stats/PRD section. Simpler than a drawer, no animation state needed.

## The 5 Apps

| # | Name | Original Stack | Port Complexity | Key Features |
|---|------|---------------|-----------------|-------------|
| 01 | Code Snippet Manager | Express + TS | Low — simple CRUD + search | Tag management, full-text search, EJS → React |
| 02 | Pipeline Observatory | Next.js 14 + TS | Low — already Next.js | SVG node graph, timeline replay, forensic inspector |
| 03 | DevCard | Next.js 14 + Framer | Low — already Next.js, uses fixture data for GitHub profiles (no live API calls) | 6 themes, language breakdown, gallery of hardcoded notable dev profiles |
| 04 | Ticket Deflection | ASP.NET Core + C# | Medium — full port to Next.js | Ticket classification, auto-resolve, dashboard with charts |
| 05 | Compliance Scanner | ASP.NET Core + C# | Medium — full port to Next.js | PIPEDA/FINTRAC scanning, disposition classification, simulation mode |

## Data Layer

All apps use **browser localStorage** for persistence. Each visitor gets their own data. Data survives page refreshes but is isolated per browser. No backend coupling.

Apps that need seed data (Ticket Deflection, Compliance Scanner) populate localStorage on first visit with realistic sample data.

## Honesty Guardrails

- Never claim "zero human code" — the apps were human-polished
- Ported apps display "Originally ASP.NET + C#" (or equivalent) — not hidden
- Stats (issues, PRs) come from the manifest.json files in /showcase/; line counts and file counts come from the README.md files (not in manifests)
- No fabricated screenshots or metrics
- DevCard uses hardcoded fixture data for GitHub profiles — no live API calls, no embedded tokens
- Note: Run 05's manifest references `run-07-compliance-scan-service-prd.md` (verified as the correct filename at tag v5.0.0) — the `run.number` field (5) is the authoritative identifier, not the filename. The `run-data.json` for this run has a different PRD filename (`run-07-compliance-scan-prd.md`) which is incorrect — use `manifest.json` as the authoritative source for PRD paths

## Route Structure

```
/                          → Landing page (includes carousel strip)
/showcase                  → Gallery page (all 5 apps)
/showcase/code-snippets    → Code Snippet Manager (functional)
/showcase/observatory      → Pipeline Observatory (functional)
/showcase/devcard          → DevCard (functional)
/showcase/ticket-deflection → Ticket Deflection (functional, ported from ASP.NET)
/showcase/compliance       → Compliance Scanner (functional, ported from ASP.NET)
```

## Data Sources

App metadata is read from the existing `showcase/*/manifest.json` files:
- Run number, name, tech stack, tag, date
- Issue and PR numbers (for counts)
- PRD path

Extended descriptions and line counts come from `showcase/*/README.md`.

## Out of Scope

- Backend API changes — apps are purely client-side
- Modifying the existing showcase/ directory structure
- Auto-generating apps from git history — these are manually ported
- Live GitHub data in the app pages (that's the evidence ledger's job)
- App-to-app navigation within the showcase
