# Frontend Agent Design (WIP)

Status: **Implemented** — all pipeline infrastructure changes landed. Ready for live testing with a `frontend + pipeline` issue.

## Context

The autonomous pipeline's `repo-assist` agent applies band-aid CSS fixes (e.g., `overflow-x: hidden`) because it has no rendering capability. It can grep CSS but can't see the result. This was proven by the mobile layout incident (PRs #385, #386, #387) where 110px of horizontal overflow was masked rather than fixed.

### Root cause analysis

The pipeline schematic on the landing page uses `flex-shrink: 0` items inside a grid child with `min-width: auto`. On a 375px viewport, this computes to 447px — overflowing the 312px content area by 135px. The agent grepped for `overflow-x` settings, found none on `html`, added `overflow-x: hidden`, and the review agent approved it because neither could render the page.

### Solution

A dedicated frontend agent with Playwright MCP that builds locally, screenshots at multiple viewports, and verifies its own changes before opening PRs.

## Design Decisions

### Model A: Full ownership (selected)

The frontend agent owns `frontend + pipeline` issues end-to-end. One agent, one issue, full lifecycle. No coordination with repo-assist needed.

Rejected alternatives:
- **QA gate model** — repo-assist implements, frontend agent reviews. Two passes, coordination complexity, repo-assist still writes CSS blind.
- **Collaboration** — race conditions on branches, concurrency cancellation, unclear ownership.

### Lean fork of repo-assist (selected)

Core loop only: read issue -> implement -> build/test -> screenshot -> PR. Includes memory for resumption. Skips: multi-task round-robin, status updates, PR maintenance, [aw] triage. repo-assist handles operational housekeeping.

## Workflow Frontmatter (approved)

```yaml
---
description: |
  Frontend-specialized agent that implements visual/UI issues.
  Uses Playwright for visual verification at multiple viewports.
  Triggered by issues labeled frontend + pipeline.

on:
  workflow_dispatch:
  slash_command:
    name: frontend-agent
    events: [issues, issue_comment]
  reaction: "art"

concurrency:
  group: "gh-aw-${{ github.workflow }}-${{ github.event.issue.number || github.event_name }}"
  cancel-in-progress: true

timeout-minutes: 45

engine:
  id: copilot
  model: gpt-5

permissions: read-all

network:
  allowed:
  - defaults
  - node
  - dotnet

tools:
  github:
    toolsets: [all]
  bash: true
  repo-memory: true
  playwright:

safe-outputs:
  create-pull-request:
    draft: false
    title-prefix: "[Frontend] "
    labels: [automation, pipeline, frontend]
    max: 2
  push-to-pull-request-branch:
    target: "*"
    title-prefix: "[Frontend] "
    max: 2
  add-comment:
    max: 5
    target: "*"
  add-labels:
    allowed: [frontend, in-progress, completed, blocked]
    max: 10
    target: "*"
  remove-labels:
    allowed: [ready, in-progress, blocked]
    max: 5
    target: "*"
---
```

Key decisions:
- `[Frontend]` title prefix distinguishes from `[Pipeline]` PRs
- `timeout: 45` — shorter than repo-assist (60min), one issue per run
- `reaction: "art"` — visual indicator vs repo-assist's "eyes"
- No schedule trigger — only dispatch or slash command
- `network: defaults` includes localhost for Playwright -> local server

## Remaining Design Sections (TODO)

### Prompt design
- Core loop (read issue -> implement -> build -> screenshot -> PR)
- Visual verification protocol (viewports, overflow detection, before/after)
- Design principles (from CLAUDE.md + impeccable skills subset)
- Memory/checkpoint protocol (lean version)

### Impeccable skills integration
- Which skills to embed: audit, adapt, polish, critique, normalize
- How to reference: inline in prompt vs read from repo

### Auto-dispatch routing
- Modify auto-dispatch.yml to route `frontend + pipeline` -> frontend-agent
- `pipeline` without `frontend` -> repo-assist (existing)
- Create `frontend` label

### Visual verification protocol
- Build locally with `dotnet run`
- Screenshot at 375px (mobile), 768px (tablet), 1440px (desktop)
- Measure `scrollWidth` vs `clientWidth` to detect hidden overflow
- Before/after comparison for regression detection
