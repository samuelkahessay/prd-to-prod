# Design: Pipeline Observatory

## Overview

A Next.js web app that visualizes, replays, and inspects the agentic pipeline.
Three views in one dashboard — Simulator, Replay, and Forensics. Hosted on Vercel.

## Views

### 1. Simulator (Interactive Sandbox)

Visual node graph of the 4 pipeline stages: prd-decomposer, repo-assist,
pr-reviewer, and auto-merge. Users interact directly with the visualization:

- Click a node to trigger its stage — animated particles flow to the next node
  showing the data produced (issues, PRs, reviews, merges)
- Each node expands on click to show what that workflow does
- Animated connections between nodes show the re-dispatch loop
- Reset button returns to initial state
- Speed control for animations

The simulator uses no real data — it's a self-contained interactive diagram.

### 2. Replay (Timeline of a Real Run)

Chronological timeline of events from the Code Snippet Manager pipeline run.
Data fetched from GitHub API at build time (ISR), with static JSON fixtures
as fallback if the API is unavailable or the repo changes.

- Horizontal scrollable timeline with events plotted by timestamp
- Event types: issue created, PR opened, review submitted, PR merged, workflow run
- Click any event for a detail panel showing the full context (issue body, diff
  stats, review decision text, merge commit)
- Filter bar to show/hide event types
- Auto-play mode: steps through events with configurable delay
- Summary stats: total duration, issues closed, PRs merged, lines changed

Timeline spans 05:29 UTC to 07:24 UTC on 2026-02-25 (the full run).

### 3. Forensics (Agent Decision Inspector)

Structured view of what the AI decided and why, for each pipeline cycle.

- Cycle cards: each repo-assist invocation shown as a card with inputs
  (issues seen) and outputs (PRs created, issues skipped)
- Review inspector: for each PR, shows the full AI review text, the
  APPROVE/REQUEST_CHANGES decision, and what acceptance criteria were checked
- Failure timeline: the 11 fixes applied during run 1 — what broke, the root
  cause, and how it was resolved
- Memory viewer: parsed view of the repo-assist state.json from the orphan branch

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Data fetching**: @octokit/rest (build-time via getStaticProps / generateStaticParams)
- **Testing**: Vitest + React Testing Library
- **Hosting**: Vercel (auto-deploy from main)

## Data Strategy

### Primary: Build-time GitHub API fetch

At build time, Next.js fetches from the GitHub API:
- Issues: `GET /repos/{owner}/{repo}/issues` (all states, label filter)
- PRs: `GET /repos/{owner}/{repo}/pulls` (all states, with reviews)
- Workflow runs: `GET /repos/{owner}/{repo}/actions/runs`
- Memory branch: `GET /repos/{owner}/{repo}/contents/state.json?ref=memory/repo-assist`

Data is serialized into static props. No runtime API calls, no auth tokens in
the browser. ISR revalidates every 24 hours.

Uses a public repo read (no auth needed for public repos) or `GITHUB_TOKEN`
if available as env var at build time.

### Fallback: Static JSON fixtures

Bundled in `src/data/fixtures/`:
- `issues.json` — all 17 issues from the Code Snippet Manager run
- `pull-requests.json` — all 11 PRs with review data
- `workflow-runs.json` — workflow run metadata
- `memory-state.json` — repo-assist state from orphan branch

These fixtures are snapshots of real data captured on 2026-02-25. If the GitHub
API fetch fails or returns unexpected data, the app falls back to fixtures
transparently.

The data loading layer exports a single `getPipelineData()` function that tries
GitHub first, catches errors, and returns fixtures on failure. Components never
know which source they're using.

## Page Structure

```
/                  — Landing page with project overview + links to 3 views
/simulator         — Interactive pipeline sandbox
/replay            — Timeline of the Code Snippet Manager run
/forensics         — Agent decision inspector
```

## Features (for PRD decomposition)

1. **Project scaffold** — Next.js 14 + TypeScript + Tailwind + Framer Motion setup,
   with vercel.json, layout, and landing page
2. **Static fixture data** — JSON fixtures for issues, PRs, workflow runs, and
   memory state, plus the data loading layer with GitHub API + fallback logic
3. **Simulator: node graph** — Interactive SVG/Canvas node graph with the 4 pipeline
   stages, click-to-activate, animated connections
4. **Simulator: node detail panels** — Expandable detail panels for each node
   showing what the workflow does, its triggers, and outputs
5. **Simulator: animation engine** — Particle/message animations flowing between
   nodes when a stage is triggered, with speed control and reset
6. **Replay: timeline component** — Horizontal scrollable timeline with events
   plotted chronologically, colored by type
7. **Replay: event detail panel** — Click-to-expand detail panel showing full
   event context (issue body, PR diff stats, review text, merge info)
8. **Replay: auto-play and filters** — Auto-play mode with speed control,
   filter bar for event types, summary statistics
9. **Forensics: cycle cards** — Cards for each repo-assist cycle showing
   inputs (issues seen) and outputs (PRs created)
10. **Forensics: review inspector** — Full AI review text display for each PR,
    with decision highlighting and acceptance criteria checklist
11. **Forensics: failure timeline** — Visual timeline of the 11 fixes with
    root cause and resolution for each
12. **Landing page and navigation** — Home page with project overview, animated
    hero, and nav bar linking to all 3 views

## Non-Functional Requirements

- All pages server-rendered or statically generated (no client-side data fetching)
- Lighthouse performance score > 90
- Responsive layout (works on mobile, optimized for desktop)
- Dark theme (pipeline/dev tool aesthetic)
- Accessible: keyboard navigable, semantic HTML, ARIA labels on interactive elements

## Out of Scope

- Live WebSocket updates from GitHub
- User authentication
- Database / persistent storage beyond static fixtures
- Editing or triggering pipeline actions from the UI
- Support for multiple pipeline runs (v1 shows only the Code Snippet Manager run)
