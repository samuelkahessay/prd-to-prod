# PRD to Prod

Drop a PRD, get a deployed app. Autonomous GitHub pipeline powered by [gh-aw](https://github.com/github/gh-aw).

Write a PRD. AI decomposes it into issues, implements each one, reviews its own PRs, and merges — looping until the entire PRD is shipped. Zero human code.

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

## Showcase

Three complete apps shipped autonomously — zero human code written.

| Run | App | Tech Stack | Tag |
|-----|-----|-----------|-----|
| 01 | [Code Snippet Manager](showcase/01-code-snippet-manager/) | Express + TypeScript | [`v1.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v1.0.0) |
| 02 | [Pipeline Observatory](showcase/02-pipeline-observatory/) | Next.js 14 + TypeScript | [`v2.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v2.0.0) |
| 03 | [DevCard](showcase/03-devcard/) | Next.js 14 + TypeScript + Framer Motion | [`v3.0.0`](https://github.com/samuelkahessay/prd-to-prod/tree/v3.0.0) |

See [`showcase/`](showcase/) for detailed run reports.

## How It Works

1. **You write a PRD** — paste it in a GitHub Issue (or reference `docs/prd/sample-prd.md` for the format)
2. **`/decompose`** — AI reads the PRD, creates issues with acceptance criteria and dependency ordering
3. **`auto-dispatch`** — New pipeline issues automatically trigger repo-assist (no manual intervention)
4. **`repo-assist`** — AI implements issues as PRs (branches from main, writes code, runs tests)
5. **`pr-review-agent`** — AI reviews each PR with full context, posts a structured verdict comment
6. **`pr-review-submit`** — Submits the formal APPROVE/REQUEST_CHANGES review as `github-actions[bot]`
7. **Auto-merge** — approved `[Pipeline]` PRs are squash-merged, closing the linked issue
8. **Re-dispatch** — pr-review-submit triggers repo-assist again for the next issue, looping until done

## Workflows

| Workflow | Type | Trigger | What it does |
|----------|------|---------|--------------|
| `prd-decomposer` | Agentic | `/decompose` command | Parses PRD into atomic issues |
| `auto-dispatch` | Standard GHA | Issue opened with `pipeline` label | Dispatches repo-assist automatically |
| `repo-assist` | Agentic | Dispatch + daily schedule | Implements issues as PRs |
| `pr-review-agent` | Agentic | PR opened/updated | AI code review (full context, no truncation) |
| `pr-review-submit` | Standard GHA | Verdict comment created | Submits formal review + auto-merge |

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

## Requirements

- GitHub account with Copilot subscription
- GitHub CLI (`gh`) v2.0+
- `gh-aw` extension installed

## License

MIT
