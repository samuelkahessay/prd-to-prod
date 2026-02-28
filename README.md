# PRD to Prod

Drop a PRD, get a deployed app. Zero human code.

An autonomous software pipeline that decomposes product requirements into GitHub Issues, implements them as Pull Requests, reviews its own code, merges — and self-heals when things break. Powered by [gh-aw](https://github.com/github/gh-aw) agentic workflows.

## What It Does

```
  PRD ──> Issues ──> Code ──> Review ──> Merge ──> Ship
                       ↑                              |
                       +────── loop until done ────────+
```

You write a product requirements document. The pipeline does everything else:

- **Decomposes** the PRD into atomic, dependency-ordered issues
- **Implements** each issue — branching, writing code, running tests, opening PRs
- **Reviews** every PR with full-context AI code review (no truncation)
- **Merges** approved PRs via squash merge, closing linked issues
- **Self-heals** — a watchdog re-dispatches stalled work every 30 min, and CI failures auto-create bug issues that feed back into the pipeline
- **Tracks progress** on a GitHub Projects v2 board, updated every run

10 workflows. No human in the loop.

## Shipped So Far

Three complete apps built autonomously — zero human code written.

| Run | App | Stack | Tag |
|-----|-----|-------|-----|
| 01 | [Code Snippet Manager](showcase/01-code-snippet-manager/) | Express + TypeScript | [`v1.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v1.0.0) |
| 02 | [Pipeline Observatory](showcase/02-pipeline-observatory/) | Next.js 14 + TypeScript | [`v2.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v2.0.0) |
| 03 | [DevCard](showcase/03-devcard/) | Next.js 14 + TypeScript + Framer Motion | [`v3.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v3.0.0) |

Each run produces a different app with a different tech stack — the pipeline is stack-agnostic.

See [`showcase/`](showcase/) for detailed run reports.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/samuelkahessay/prd-to-prod.git
cd prd-to-prod

# 2. Install gh-aw
gh extension install github/gh-aw

# 3. Bootstrap (creates labels, compiles workflows, seeds memory)
bash scripts/bootstrap.sh

# 4. Configure secrets
gh aw secrets bootstrap

# 5. Push
git push

# 6. Create an issue with your PRD, then comment: /decompose
```

**Requirements:** GitHub account with Copilot subscription, GitHub CLI (`gh`) v2.0+, `gh-aw` extension.

## How the Pipeline Works

1. **Write a PRD** — paste it in a GitHub Issue
2. **`/decompose`** — AI breaks it into issues with acceptance criteria and dependency ordering
3. **`repo-assist`** — AI implements each issue as a PR (branch, code, test, open)
4. **`pr-review-agent`** — AI reviews the full diff against acceptance criteria
5. **`pr-review-submit`** — formal review + squash merge + re-dispatch for the next issue
6. **Self-healing** — watchdog catches stalls, CI failures become auto-fix issues

The loop runs until every issue from the PRD is shipped.

For the full architecture, workflow details, design decisions, and self-healing mechanics, see [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md).

## License

MIT
