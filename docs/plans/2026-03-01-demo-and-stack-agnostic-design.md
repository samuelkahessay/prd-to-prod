# Design: Landing Page Demo + Tech-Stack Agnostic Architecture

**Date:** 2026-03-01
**Status:** Approved

---

## Context

prd-to-prod is an autonomous software pipeline — drop a PRD as a GitHub issue, and agents decompose it, implement it, review it, and deploy it. Four runs have proven this across Express, Next.js (x2), and ASP.NET Core.

Two problems:
1. **The live site is a specimen app**, not a showcase of the pipeline itself. Visitors see a ticket deflection demo, not the process that built it. The site should be the front door to the repo — proving the pipeline works and driving people to fork it.
2. **Deployment is hardcoded to Azure.** The decomposer and repo-assist are stack-agnostic, but CI/CD is not. Adding a new tech stack requires manually writing deploy workflows.

## Work Breakdown

Three sequential pieces:

| # | Piece | Method | Why not dogfooded |
|---|-------|--------|-------------------|
| 1 | Deploy Profile System | Direct (pipeline infra) | Pipeline infrastructure — needs to exist before the pipeline can use it |
| 2 | Run Data Capture Scripts | Direct (pipeline infra) | Scripts that harvest GitHub API data — prerequisite for the landing page |
| 3 | Landing Page PRD (Run 5) | Dogfooded (full pipeline) | First real test of the deploy profile system |

---

## Piece 1: Deploy Profile System

### Problem

`deploy-azure.yml` is hardcoded. `dotnet-ci.yml` is hardcoded. Adding Vercel or Docker deployment means manually swapping workflows between runs.

### Solution: Deploy Profiles

A deploy profile is a config file that maps a tech stack to its CI/CD requirements.

**Directory structure:**
```
.github/deploy-profiles/
├── nextjs-vercel.yml
├── dotnet-azure.yml
├── docker-generic.yml
└── profile-schema.yml
```

**Each profile defines:**
- `stack` — identifier (nextjs, dotnet, docker)
- `detect` — file patterns for auto-detection (e.g., `["package.json", "next.config.*"]`)
- `build` — build commands and output path
- `test` — test commands
- `deploy` — reusable workflow reference + required secrets/vars
- `ci` — CI workflow for PR checks

**Pipeline integration:**

```
PRD (optionally specifies stack)
       ↓
[prd-decomposer]
  1. Reads PRD for explicit stack preference
  2. If none → infers from requirements
  3. Selects deploy profile
  4. First decomposed issue = bootstrap with selected stack + profile
       ↓
[repo-assist]
  1. Reads deploy profile
  2. Scaffolds project, wires CI/CD per profile
       ↓
[deploy-router.yml]  ← NEW (replaces hardcoded deploy-azure.yml)
  1. Triggered on push to main
  2. Reads .deploy-profile pointer in repo root
  3. Dispatches to correct deploy workflow
       ↓
[deploy-vercel.yml] OR [deploy-azure.yml] OR [deploy-docker.yml]
```

**Defaults:**
- No stack in PRD → Next.js + Vercel (best general-purpose web default)
- .NET/C#/Azure mentioned → dotnet-azure
- Docker or unknown stack → docker-generic

**Adding a new stack later:**
1. Create `.github/deploy-profiles/python-railway.yml`
2. Create `.github/workflows/deploy-railway.yml`
3. Update decomposer prompt to recognize indicators
4. Done

### What Changes

| Component | Current | After |
|-----------|---------|-------|
| `deploy-azure.yml` | Always runs on push to main | Only runs when dotnet-azure profile active |
| `dotnet-ci.yml` | Always runs on PR | Only runs when dotnet profile active |
| `prd-decomposer.md` | No stack awareness | Detects/infers stack, selects profile |
| `repo-assist.md` | No deploy awareness | Reads profile for CI/CD setup |
| New: `deploy-router.yml` | — | Routes to correct deploy workflow |
| New: `.github/deploy-profiles/` | — | Config files per stack |
| New: `.deploy-profile` | — | Pointer to active profile in repo root |

---

## Piece 2: Run Data Capture Scripts

### Problem

The landing page visualization needs real pipeline data from past runs (issues, PRs, reviews, timelines). This data needs to be captured and stored as static JSON.

### Solution

**New script:** `scripts/capture-run-data.sh`

Harvests from GitHub API for a given run:
- All issues created during the run (titles, bodies, labels, acceptance criteria, timestamps)
- All PRs (titles, bodies, file changes, line counts, review comments, verdicts)
- Timeline events (issue created → PR opened → review → merge → deploy)
- Run stats (total issues, PRs, lines changed, duration, self-healing events)

**Output:** `/showcase/{run-number}/run-data.json`

**Captures for existing runs:**
- Run 1 (v1.0.0): Code Snippet Manager
- Run 2 (v2.0.0): Pipeline Observatory
- Run 3 (v3.0.0): DevCard
- Run 4 (v4.0.0): Ticket Deflection

**Run 5 will self-capture** — the landing page's own pipeline data gets added to the showcase after it completes.

---

## Piece 3: Landing Page PRD (Run 5 — Dogfooded)

### Purpose

A landing page for the prd-to-prod framework. Not a specimen app — the front door to the GitHub repo. Drives visitors to clone/fork and build their own PRD→product pipelines.

### Page Structure

1. **Hero** — "Drop a PRD, get a product." One-liner + GitHub stars badge + "Get Started" (→ repo) + "Watch it work" (→ replay)

2. **How it works** — 3-4 step visual: Write PRD → Decompose → Agents build → Auto-deploy. Clean, icon-driven.

3. **Pipeline Replay** — Centerpiece. Interactive visualization replaying a real past run. Visitors toggle between runs 1-5 to see different stacks. Each replay shows real issues, real PRs, real reviews, real deploy. All data from captured JSON — zero API calls.

4. **Showcase grid** — Cards per run: app name, tech stack, stats, live link, PRD link. Visual proof of stack agnosticism.

5. **Get Started** — Fork → Write PRD → Run pipeline. Links to repo, docs, PRD template.

6. **Footer** — Architecture, gh-aw, license.

### The Meta-Story

- This site IS Run 5 — built by the pipeline it demonstrates
- Listed in its own showcase grid
- Its own pipeline replay is one of the selectable runs
- "This landing page was built by prd-to-prod" closing line

### Tech Stack

- Specified in PRD as web-focused (the decomposer/pipeline will decide, but likely Next.js or similar for rich interactive visualization)
- Deployed to Azure App Service (continuing Run 4 hosting)
- Uses deploy profile system (Piece 1) — first real test of the new architecture
- Data sourced from static JSON files (Piece 2)

### Not In Scope

- User accounts or hosted pipeline (this is not a SaaS)
- Live pipeline execution for visitors (replay only — zero token cost)
- PRD authoring tool (just a template + "copy to clipboard")

---

## Sequencing

```
Piece 1: Deploy Profiles (direct)
  └─ enables →
Piece 2: Data Capture (direct)
  └─ provides data for →
Piece 3: Landing Page PRD (dogfooded as Run 5)
  └─ first real test of deploy profiles
  └─ uses captured run data for visualization
  └─ self-captures its own run data on completion
```

## Open Questions

- **Run 5 deploy profile**: Landing page on Azure suggests dotnet-azure or docker-generic. If the pipeline picks Next.js, it'll use nextjs-vercel profile — but we want Azure hosting. May need a `nextjs-azure.yml` profile or use docker-generic to deploy Next.js to Azure via Docker.
- **Replay visualization library**: Left to the pipeline to decide. The PRD should describe the desired behavior, not the implementation.
- **PRD template on site**: Simple markdown textarea + "Copy to clipboard" is sufficient for v1. Interactive builder can come later.
