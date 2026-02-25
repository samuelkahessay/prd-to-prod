# Agents Configuration

## Project Overview
This repository is managed by an agentic pipeline. Issues are created from PRDs
by the prd-decomposer workflow, and implemented by the repo-assist workflow.

## Coding Standards
- Write tests for all new functionality
- Follow existing naming conventions
- Keep functions small and single-purpose
- Add comments only for non-obvious logic
- Use TypeScript strict mode

## Build & Test
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

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
