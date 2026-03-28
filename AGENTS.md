# Agents Configuration

## Project Overview
This repository is managed by an autonomous pipeline. Issues are created from PRDs
by the prd-decomposer workflow, and implemented by the repo-assist workflow.

## Coding Standards
- Write tests for all new functionality
- Follow existing naming conventions
- Keep functions small and single-purpose
- Add comments only for non-obvious logic
- Use TypeScript strict mode when the PRD specifies TypeScript

## Build & Test
Use `bash scripts/validate-implementation.sh` as the canonical build and test gate.
Then run any issue-specific commands listed under the issue's `## Required Validation` section.
Enhancement runs may extend the current application in place, so do not assume a clean-slate scaffold.

## Tech Stack
Constrained by the current template. The supported product surface is web apps
on the `nextjs-vercel` lane; do not assume dormant `.NET` or Docker deploy
paths exist unless they are explicitly added back.

## PR Requirements
- PR body must include `Closes #N` referencing the source issue
- All tests must pass before requesting review
- PR title should be descriptive (not just the issue title)

## What Agents Should NOT Do
- Modify workflow files (.github/workflows/)
- Change dependency versions without explicit instruction in the issue
- Refactor code outside the scope of the assigned issue
- Add new dependencies without noting them in the PR description
- Merge their own PRs

## Labels
- `feature` — New feature implementation
- `test` — Test coverage
- `infra` — Infrastructure / scaffolding
- `docs` — Documentation
- `bug` — Bug fix

## PRD Lifecycle
This repo follows a drop → run → tag → showcase → reset cycle:

Enhancement runs are allowed. A new PRD may evolve the current application in place when the repo still contains active app code.

### Permanent files (pipeline infrastructure)
- `.github/` — Workflows, agent configs, copilot instructions
- `scripts/` — Bootstrap, archive, monitoring scripts
- `docs/prd/` — PRD input records (kept forever)
- `docs/ARCHITECTURE.md` — Pipeline architecture documentation
- `showcase/` — Completed run summaries with links to git tags
- `AGENTS.md` — This file (reset to defaults between runs)
- `README.md`, `LICENSE`, `.gitignore`

### Ephemeral files (removed on archive)
- `web/`, `src/`, `PRDtoProd/`, `PRDtoProd.Tests/` — Application code (implementation of the active PRD)
- `package.json`, `tsconfig.json`, `PRDtoProd.sln`, `Dockerfile`, `global.json`, etc. — PRD-specific configs
- `docs/plans/` — Design documents for the active PRD
- `node_modules/`, `.next/`, `dist/`, `drills/reports/*.json` — Build and generated artifacts
