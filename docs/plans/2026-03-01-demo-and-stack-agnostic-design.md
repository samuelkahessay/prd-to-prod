# Design Review: Landing Page Demo + Tech-Stack Agnostic Architecture

**Date:** 2026-03-01
**Review Updated:** 2026-03-02
**Status:** In Progress

---

## Context

`prd-to-prod` has already proven the core pipeline across four runs:

- Run 1: Express + TypeScript
- Run 2: Next.js + TypeScript
- Run 3: Next.js + TypeScript + Framer Motion
- Run 4: ASP.NET Core + C#

The original goal of this plan was to do three things:

1. Make deployment and CI profile-based instead of hardcoded to one stack
2. Capture static run data for a showcase and replay experience
3. Turn the live site into a proper front door for the repo instead of only showing the specimen app

This review updates the plan against the current repository state so it is clear what is already done, what is partially done, and what still needs implementation.

---

## Status Summary

| Piece | Original Intent | Current State | Status |
|---|---|---|---|
| 1 | Deploy Profile System | Profiles, router, pointer file, and agent instructions exist | Mostly done |
| 2 | Run Data Capture | Capture script, manifests, and `run-data.json` files for runs 1-4 exist | Mostly done |
| 3 | Landing Page Demo | Front-door narrative exists on the homepage, but replay and data-driven showcase are not implemented; this iteration is now designated as formal Run 05 | Partial |

---

## Piece 1: Deploy Profile System

### What Is Implemented

- `.deploy-profile` exists in the repo root and currently points to `dotnet-azure`
- Deploy profiles exist for:
  - `nextjs-vercel`
  - `dotnet-azure`
  - `docker-generic`
- `deploy-router.yml` reads `.deploy-profile` and dispatches to the matching deploy workflow
- `dotnet-ci.yml`, `ci-node.yml`, and `ci-docker.yml` are gated by the active profile
- `prd-decomposer.md` includes stack detection and bootstrap issue guidance
- `repo-assist.md` instructs the agent to read the active deploy profile before implementing issues

### What Is Good

- The repo is no longer locked to a single deploy path on push to `main`
- Stack selection is now part of decomposition instead of being implicit
- The profile concept is simple and understandable
- The current setup is good enough to support the existing .NET, Next.js, and Docker paths

### What Still Needs Improvement

- The workflows are routed by profile, but they are not fully driven by profile data yet
- The .NET workflows still hardcode solution and project paths instead of resolving from profile config
- Adding a new stack still requires a new workflow plus prompt updates; it is not yet close to plug-and-play
- The planned `profile-schema.yml` does not exist, so there is no validation contract for profile files
- The profile shape in the doc was slightly off: test commands currently live under `build`, not as a separate top-level block

### Revised Conclusion

Piece 1 should be considered **implemented structurally**, but not fully complete as a stack-agnostic execution system. The right claim today is:

> Deploy and CI routing are profile-based, but the concrete workflow steps are still partly stack-specific.

---

## Piece 2: Run Data Capture

### What Is Implemented

- `scripts/capture-run-data.sh` exists
- `showcase/*/manifest.json` exists for runs 1-4
- `showcase/*/run-data.json` exists for runs 1-4
- The generated data includes:
  - run metadata
  - issue metadata
  - PR metadata
  - review metadata
  - changed-file summaries
  - issue/PR/review/merge timeline events
  - basic aggregate stats

### Current Captured Totals

Across the four existing runs, the static data currently captures:

- 90 issues
- 86 pull requests
- 86 merged pull requests

### What Is Good

- The repo now has a real static dataset for a showcase UI
- The data model is already strong enough for a first replay or timeline view
- The script output is straightforward and easy for a frontend to consume

### What Still Needs Improvement

- The script does not currently capture deploy events
- The script does not currently compute run duration
- The script does not currently capture self-healing or retry events
- There is no automatic "self-capture" for a future run; capture is still a manual script step
- There are no regression tests for the capture script or the output shape
- Nothing on the live homepage currently reads these JSON files

### Revised Conclusion

Piece 2 is **implemented as a usable data source**, but the doc should stop promising deploy, duration, and self-healing metrics until they actually exist in the output.

---

## Piece 3: Landing Page Demo

### What Is Implemented

The current homepage already does part of the intended job:

- Hero section with the "Drop a PRD. Get a deployed app." framing
- Pipeline schematic explaining decomposition, implementation, review, and merge
- Run history section showing the four previous runs
- Provenance section pointing people back to the public repo
- Clear visual separation between the pipeline story and the specimen app
- Closing line reinforcing that the site was built by the pipeline

### What Is Good

- The live site is no longer only a specimen app homepage
- The top of the page now tells the pipeline story first
- The visual direction is distinct and intentional
- The specimen app is demoted to "proof" instead of being the whole message

### What Still Needs Improvement

- The landing page does not consume `showcase/*/run-data.json`
- The run history cards are hardcoded instead of data-driven
- The hardcoded counts are stale relative to the captured run data
- There is no interactive replay UI
- There is no run selector driven by the captured JSON
- There is no explicit "Get Started" section with repo/docs/template actions
- There is no footer block matching the planned architecture/gh-aw/license links
- There is no `Run 5` artifact in `showcase/`, so the site is not yet represented as its own showcase run
- The "this site is Run 5" meta-story has not actually been completed in the repo

### Revised Conclusion

Piece 3 is **partially implemented**. The homepage is already a front door, but it is not yet the full dogfooded replay-driven landing page described in the original plan.

This landing-page iteration is now explicitly intended to archive as **Run 05** once the remaining product work is complete.

---

## Remaining Work Checklist

### P0: Make the Homepage Trustworthy and Data-Driven

- Replace hardcoded run-history counts with values derived from `showcase/*/run-data.json`
- Load showcase metadata from static JSON instead of embedding run cards directly in markup
- Align run totals on the page with the captured dataset

### P1: Ship the Planned Landing-Page Experience

- Add a dedicated "Get Started" section with links to:
  - repo
  - docs
  - PRD template
- Add a replay/timeline component for at least one run using the captured timeline data
- Add a run selector so visitors can compare stacks across past runs
- Add footer links for architecture, `gh-aw`, and license

### P1: Formalize Run 05

- Treat the landing-page iteration as a real archived run, not just an incremental homepage tweak
- When the work is complete:
  - archive it as `showcase/05-landing-page-demo`
  - capture its run data
  - tag it as `v5.0.0`
  - list it in the showcase index
- Do not create the showcase entry early; `showcase/` should remain a record of completed runs only

### P2: Strengthen the Deploy-Profile System

- Add a profile schema or validation check
- Reduce hardcoded workflow paths where practical
- Decide whether to support a `nextjs-azure` profile or keep web-default deployment on Vercel
- Document the exact profile contract in one place

### P2: Strengthen the Run-Data Pipeline

- Extend the capture script with deploy events
- Add duration metrics
- Add self-healing and retry metrics if they are important to the replay story
- Add regression tests for the capture script and data shape

---

## Landing Page Review Against the Original Plan

| Planned Section | Current State | Assessment | Needed Improvement |
|---|---|---|---|
| Hero | Exists and is strong | Good | Add stars badge and a second CTA if desired |
| How it works | Exists as a pipeline schematic | Good | Could be simplified for non-technical visitors |
| Pipeline Replay | Missing | Not done | Build from `run-data.json` timeline data |
| Showcase Grid | Partially exists as run history | Partial | Make it data-driven, add live links/PRD links/stats from JSON |
| Get Started | Missing as a dedicated section | Not done | Add fork, PRD template, docs, and workflow steps |
| Footer | Minimal closing line only | Partial | Add architecture, `gh-aw`, and license links |
| Meta-story: "this site is Run 5" | Decision made, but not yet represented in repo artifacts | Partial | Finish the landing-page work, then archive/tag/capture it as Run 05 |

---

## Decision Updates

### Hosting Direction

The current live site is still the ASP.NET Core app on Azure, and `.deploy-profile` is set to `dotnet-azure`. The repository has not actually crossed into a new web-stack deployment for the landing page.

### Replay Scope

A first version of replay does not need a complex visualization library. The existing static JSON is already enough for:

- timeline playback
- issue and PR counts
- run summaries
- review event markers

The implementation can stay simple and still satisfy the product goal.

### Run 05 Decision

The landing-page iteration is now formally designated as **Run 05**.

Planning defaults for that archive:

- Showcase slug: `05-landing-page-demo`
- Tag: `v5.0.0`
- Expected archive inputs:
  - final landing page implementation
  - captured `run-data.json`
  - showcase README/manifest

Until those artifacts exist, the repo should describe Run 05 as **planned and in progress**, not completed.

---

## Recommended Next Sequence

1. Make the existing homepage data-driven from the captured showcase JSON
2. Add a simple replay/timeline for one run, then expand it to all runs
3. Complete the landing-page feature set and archive it as Run 05
4. Tighten the deploy-profile contract only after the user-facing landing page is in better shape

---

## Bottom Line

The original design direction was correct.

The main issue is not the plan itself; it is that the document no longer matches the repo. Pieces 1 and 2 largely shipped, and Piece 3 partially shipped in a different form than originally described. The revised plan should now be treated as:

- a current-state record of what exists
- a gap list for the landing page
- a smaller follow-on plan for replay, data-driven rendering, and formal Run 05 archival
