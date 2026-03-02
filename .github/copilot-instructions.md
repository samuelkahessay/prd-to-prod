# Copilot Agent Instructions

## Project Overview
This repository is an **autonomous GitHub development pipeline** powered by
[gh-aw](https://github.com/github/gh-aw) (GitHub Agentic Workflows). It turns
Product Requirements Documents (PRDs) into implemented code via AI agents:

1. **You write a PRD** and push it to `docs/prd/`, or paste it in an issue
2. **`prd-decomposer`** — AI reads the PRD, creates GitHub Issues with
   acceptance criteria
3. **`repo-assist`** — AI picks up issues, writes code, opens draft PRs
4. **`pr-review-agent`** — Agentic review posts a verdict comment (full context, no truncation)
5. **`pr-review-submit`** — Submits the formal APPROVE/REQUEST_CHANGES review as `github-actions[bot]` and auto-merges approved `[Pipeline]` PRs
6. **`pipeline-status`** — Daily dashboard tracks progress

Human role: write PRDs, review outcomes, and manually merge non-pipeline PRs.

## Repository Structure
```
.github/                         # Pipeline infrastructure (PERMANENT)
  copilot-instructions.md        # Instructions for Copilot (this file)
  copilot-setup-steps.yml        # Agent dev environment setup
  agents/
    agentic-workflows.agent.md   # Agent configuration for gh-aw workflows
  workflows/
    prd-decomposer.md            # PRD → Issues workflow
    prd-decomposer.lock.yml      # Compiled Actions YAML
    repo-assist.md               # Issues → PRs workflow
    repo-assist.lock.yml         # Compiled Actions YAML
    pipeline-status.md           # Progress dashboard workflow
    pipeline-status.lock.yml     # Compiled Actions YAML
    pr-review-agent.md           # Agentic PR review workflow
    pr-review-agent.lock.yml     # Compiled Actions YAML
    pr-review-submit.yml         # Formal review submission workflow
    close-issues.yml             # Auto-close issues on PR merge
    pipeline-watchdog.yml        # Stall detector (cron)
    copilot-setup-steps.yml      # Agent environment bootstrap
docs/                            # Pipeline infrastructure (PERMANENT)
  prd/                           # Drop PRDs here (kept forever)
  plans/                         # Design documents (EPHEMERAL — removed on archive)
scripts/                         # Pipeline infrastructure (PERMANENT)
  bootstrap.sh                   # One-time setup (labels, compile workflows)
  archive-run.sh                 # Tag, showcase, and reset after a PRD run
  start-run.sh                   # Prepare for a new PRD run
  monitor-pipeline.sh            # Live monitoring loop
showcase/                        # Completed run portfolios (PERMANENT)
  01-code-snippet-manager/       # Run 1 summary → tag v1.0.0
  02-pipeline-observatory/       # Run 2 summary → tag v2.0.0
AGENTS.md                        # Coding standards for all agents
src/                             # PRD implementation code (EPHEMERAL)
package.json, tsconfig.json ...  # PRD-specific configs (EPHEMERAL)
```

## PRD Lifecycle
The pipeline follows a **drop → run → tag → showcase → reset** cycle.

- **Permanent files** (`.github/`, `scripts/`, `docs/prd/`, `showcase/`,
  `AGENTS.md`, `README.md`) survive across runs
- **Ephemeral files** (`src/`, `package.json`, config files, `docs/plans/`)
  are removed when archiving a completed run
- After archive, the repo is a clean slate ready for the next PRD
- All implementation code is recoverable via `git checkout <tag> -- src/`

## Agentic Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `prd-decomposer` | `/decompose` command | Parses PRD → creates issues |
| `repo-assist` | Daily + `/repo-assist` | Implements issues → opens PRs |
| `pipeline-status` | Daily | Updates progress dashboard issue |
| `pr-review-agent` | PR opened/updated | AI code review (full context) |
| `pr-review-submit` | Verdict comment created | Submits formal review + auto-merge for approved `[Pipeline]` PRs |

## Pipeline Issue Lifecycle
1. `prd-decomposer` creates issues with `[Pipeline]` prefix and `pipeline` label
2. Issues include acceptance criteria, dependencies (`Depends on #N`), and
   type labels (`feature`, `test`, `infra`, `docs`, `bug`)
3. `repo-assist` picks up issues in dependency order, creates branches
   (`repo-assist/issue-<N>-<desc>`), implements code, and opens draft PRs
4. `pr-review-agent` reviews pipeline PRs with full context, posts a verdict comment
5. `pr-review-submit` reads the verdict and submits the formal APPROVE/REQUEST_CHANGES review
6. On approval of a `[Pipeline]` PR, auto-merge is enabled; on merge, the linked
   issue auto-closes via `Closes #N`
7. `repo-assist` re-dispatches to pick up the next issue

Human-authored PRs can still use the same review and CI workflows, but they
are manually merged by default.

## PR Conventions
- Title prefix: `[Pipeline]` for all agent-created PRs
- Body must contain `Closes #N` referencing the source issue
- PRs include AI disclosure: "This PR was created by Pipeline Assistant."
- All tests must pass before the PR is approved
- Labels: `automation`, `pipeline`

## Labels
| Label | Description |
|-------|-------------|
| `pipeline` | Pipeline-managed issue |
| `feature` | New feature implementation |
| `test` | Test coverage |
| `infra` | Infrastructure / scaffolding |
| `docs` | Documentation |
| `bug` | Bug fix |
| `automation` | Created by automation |
| `in-progress` | Work in progress |
| `blocked` | Blocked by dependency |
| `ready` | Ready for implementation |
| `completed` | Completed and merged |
| `report` | Status report |

## Working with This Repo
- **Read `AGENTS.md` first** for project-specific coding standards and build
  commands — the application code evolves as the pipeline implements PRDs
- **Run `scripts/bootstrap.sh`** to set up labels and compile workflows
- **Compile workflows** after editing any `.md` workflow file:
  `gh aw compile`
- **Do not modify** `.github/workflows/*.lock.yml` files directly — they are
  generated by `gh aw compile`
- **Do not modify** `.github/workflows/*.yml` files (standard Actions
  workflows) unless explicitly instructed

## Restrictions
- **Never edit** `.github/workflows/*.lock.yml` — these are generated by `gh aw compile`
- **Never edit** `.github/workflows/*.yml` (standard Actions workflows) unless explicitly asked
- `.github/workflows/*.md` (agentic workflow sources) **may** be edited, but always run `gh aw compile` after
- Do not add dependencies without noting in PR
- Do not refactor code outside the scope of the assigned issue
- Do not change dependency versions without explicit instruction
- Do not merge your own PRs
