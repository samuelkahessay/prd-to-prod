# Agentic Pipeline

Autonomous GitHub development pipeline powered by [gh-aw](https://github.com/github/gh-aw).

Write a PRD. AI decomposes it into issues, implements each one, reviews its own PRs, and merges — looping until the entire PRD is shipped.

## Architecture

```
  You write a PRD
        |
        |  /decompose
        v
  prd-decomposer ──> GitHub Issues (atomic, dependency-ordered)
                           |
                           v
                      repo-assist ──> Pull Requests (branched, tested)
                           |               |
                           |               v
                           |         pr-review-agent  (AI code review)
                           |               |
                           |         pr-review-submit (formal review)
                           |               |
                           |          APPROVE + auto-merge (squash)
                           |               |
                           |               v
                           +──── re-dispatch if issues remain
```

Each cycle: repo-assist implements an issue as a PR, pr-review-agent reviews it with full context (no truncation), pr-review-submit approves and squash-merges it (auto-closing the linked issue via `Closes #N`), then re-dispatches repo-assist for the next issue. The loop runs until every issue from the PRD is done.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Demo: First Pipeline Run

The pipeline autonomously built a **Code Snippet Manager** (Express + TypeScript web app) from a single PRD — 8 features, zero human intervention.

**PRD decomposition** — one `/decompose` command created 8 atomic issues:

| Issue | Feature |
|-------|---------|
| [#7](https://github.com/samuelkahessay/agentic-pipeline/issues/7) | Scaffold Express + TypeScript Project |
| [#8](https://github.com/samuelkahessay/agentic-pipeline/issues/8) | Build Web UI: Snippet List & Dashboard |
| [#9](https://github.com/samuelkahessay/agentic-pipeline/issues/9) | Build Web UI: Snippet Detail, Create & Edit Pages |
| [#10](https://github.com/samuelkahessay/agentic-pipeline/issues/10) | Implement Snippet Data Model & In-Memory Store |
| [#11](https://github.com/samuelkahessay/agentic-pipeline/issues/11) | Add Tag Management API Endpoints |
| [#12](https://github.com/samuelkahessay/agentic-pipeline/issues/12) | Seed Example Snippets & Landing Experience |
| [#13](https://github.com/samuelkahessay/agentic-pipeline/issues/13) | Create CRUD API Endpoints for Snippets |
| [#14](https://github.com/samuelkahessay/agentic-pipeline/issues/14) | Implement Full-Text Search API for Snippets |

**Implementation** — repo-assist created PRs for each, pr-reviewer approved with real AI reviews (GPT-5 via GitHub Models API), and auto-merge shipped them:

| PR | What it shipped |
|----|----------------|
| [#16](https://github.com/samuelkahessay/agentic-pipeline/pull/16) | Express + TypeScript scaffold |
| [#17](https://github.com/samuelkahessay/agentic-pipeline/pull/17) | Snippet data model & store |
| [#18](https://github.com/samuelkahessay/agentic-pipeline/pull/18) | CRUD API endpoints |
| [#20](https://github.com/samuelkahessay/agentic-pipeline/pull/20) | Tag management + full-text search |
| [#21](https://github.com/samuelkahessay/agentic-pipeline/pull/21) | Snippet list & dashboard UI |
| [#26](https://github.com/samuelkahessay/agentic-pipeline/pull/26) | Detail, create & edit pages |
| [#27](https://github.com/samuelkahessay/agentic-pipeline/pull/27) | Seed data & landing experience |

All 8 issues were closed after merge. Application code was removed after the run to reset for the next PRD (tagged [v1.0.0](https://github.com/samuelkahessay/agentic-pipeline/tree/v1.0.0)).

## Showcase

Each completed PRD run is archived with a git tag and a showcase entry.
Full code is recoverable via `git checkout <tag> -- src/`.

| Run | PRD | Tech Stack | Tag |
|-----|-----|-----------|-----|
| 01 | [Code Snippet Manager](showcase/01-code-snippet-manager/) | Express + TypeScript | [`v1.0.0`](https://github.com/samuelkahessay/agentic-pipeline/tree/v1.0.0) |
| 02 | [Pipeline Observatory](showcase/02-pipeline-observatory/) | Next.js 14 + TypeScript | [`v2.0.0`](https://github.com/samuelkahessay/agentic-pipeline/tree/v2.0.0) |
| 03 | [DevCard](showcase/03-devcard/) | Next.js 14 + TypeScript + Framer Motion | [`v3.0.0`](https://github.com/samuelkahessay/agentic-pipeline/tree/v3.0.0) |

See [`showcase/`](showcase/) for detailed run reports.

## PRD Lifecycle

The pipeline follows a repeatable **drop → run → tag → showcase → reset** cycle:

```
1. Drop PRD          bash scripts/start-run.sh ~/my-prd.md
2. Decompose         Comment /decompose on the PRD issue
3. Pipeline runs     Agent implements all issues → PRs → merge (no-touch)
4. Tag & archive     bash scripts/archive-run.sh 03 my-project v3.0.0
5. Clean slate       Ready for the next PRD
```

**Permanent** (pipeline infrastructure): `.github/`, `scripts/`, `docs/prd/`, `showcase/`, `AGENTS.md`, `README.md`
**Ephemeral** (removed on archive): `src/`, `package.json`, `tsconfig.json`, config files, `docs/plans/`

## How It Works

1. **You write a PRD** — paste it in a GitHub Issue (or reference `docs/prd/sample-prd.md` for the format)
2. **`/decompose`** — AI reads the PRD, creates issues with acceptance criteria and dependency ordering
3. **`repo-assist`** — AI implements issues as PRs (branches from main, writes code, runs tests)
4. **`pr-review-agent`** — AI reviews each PR with full context (no truncation), posts a structured verdict comment
5. **`pr-review-submit`** — Submits the formal APPROVE/REQUEST_CHANGES review as `github-actions[bot]`
6. **Auto-merge** — approved `[Pipeline]` PRs are squash-merged, closing the linked issue
7. **Re-dispatch** — pr-review-submit triggers repo-assist again for the next issue, looping until done

## Workflows

| Workflow | Type | Trigger | What it does |
|----------|------|---------|--------------|
| `prd-decomposer` | Agentic | `/decompose` command | Parses PRD into atomic issues |
| `repo-assist` | Agentic | Dispatch + daily schedule | Implements issues as PRs |
| `pr-review-agent` | Agentic | PR opened/updated | AI code review (full context, no truncation) |
| `pr-review-submit` | Standard GHA | Verdict comment created | Submits formal review + auto-merge |
| `pipeline-status` | Agentic | Daily schedule | Updates rolling status issue |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/samuelkahessay/agentic-pipeline.git
cd agentic-pipeline

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

## Requirements

- GitHub account with Copilot subscription
- GitHub CLI (`gh`) v2.0+
- `gh-aw` extension installed

## License

MIT
