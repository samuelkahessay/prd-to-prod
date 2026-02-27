# Agents Configuration

## Project Overview
This repository is managed by an agentic pipeline. Issues are created from PRDs
by the prd-decomposer workflow, and implemented by the repo-assist workflow.

## Coding Standards
- Write tests for all new functionality
- Follow existing naming conventions
- Keep functions small and single-purpose
- Add comments only for non-obvious logic
- Use TypeScript strict mode when the PRD specifies TypeScript

## Build & Test
Check the active PRD and package.json for build/test commands.
When no PRD is active, there is no application code to build.

## Tech Stack
Determined by the active PRD. The pipeline is tech-stack agnostic.

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

### Permanent files (pipeline infrastructure)
- `.github/` — Workflows, agent configs, copilot instructions
- `scripts/` — Bootstrap, archive, monitoring scripts
- `docs/prd/` — PRD input records (kept forever)
- `docs/ARCHITECTURE.md` — Pipeline architecture documentation
- `showcase/` — Completed run summaries with links to git tags
- `AGENTS.md` — This file (reset to defaults between runs)
- `README.md`, `LICENSE`, `.gitignore`

### Ephemeral files (removed on archive)
- `src/` — Application code (implementation of the active PRD)
- `package.json`, `tsconfig.json`, etc. — PRD-specific configs
- `docs/plans/` — Design documents for the active PRD
- `node_modules/`, `.next/`, `dist/` — Build artifacts
