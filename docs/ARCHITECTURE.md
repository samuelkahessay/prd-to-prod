# Architecture

## Pipeline Overview

The agentic pipeline turns Product Requirements Documents (PRDs) into shipped code
with minimal human intervention. Six workflows cooperate in a loop:

```
 You write a PRD
       |
       v
 +-----------------+     creates      +------------------+
 | prd-decomposer  | ──────────────>  | GitHub Issues    |
 | (agentic, gpt-5)|     (atomic,     | with acceptance  |
 +-----------------+   ordered by dep) | criteria         |
       |                               +------------------+
       | dispatches                           |
       v                                      |
 +-----------------+     implements           |
 | repo-assist     | <───────────────────────-+
 | (agentic, gpt-5)|
 +-----------------+
       |
       | opens PR
       v
 +-----------------+  posts verdict   +--------------------+
 | pr-review-agent | ──────────────> | pr-review-submit | ──> Squash merge (auto)
 | (agentic, gpt-5)|  (comment)       | (GHA, bot)         |
 +-----------------+                  +--------------------+
       |                                      |
       | re-dispatches if                     | triggers
       | issues remain                        v
       |                              +------------------+
       |                              | close-issues     |
       |                              | (GHA, on merge)  |
       |                              +------------------+
       v                                      |
 +-----------------+                          |
 | repo-assist     | <───── cycle continues ──+
 +-----------------+
       ^
       |  detects stalls
 +-----------------+
 | pipeline-       |
 | watchdog        |
 | (cron, 30 min)  |
 +-----------------+
```

## Workflows

### prd-decomposer

| | |
|---|---|
| **File** | `.github/workflows/prd-decomposer.md` |
| **Engine** | Copilot (gpt-5) |
| **Trigger** | `/decompose` command on an issue |
| **Output** | Up to 20 atomic GitHub Issues with `[Pipeline]` prefix, acceptance criteria, and dependency ordering |

Reads a PRD from the issue body, decomposes it into implementable issues labeled
`pipeline` + a type label (`feature`, `infra`, `test`, `docs`, `bug`). Issues
reference each other via temporary IDs for dependency ordering. After creating
all issues, dispatches `repo-assist` once.

### repo-assist

| | |
|---|---|
| **File** | `.github/workflows/repo-assist.md` |
| **Engine** | Copilot (gpt-5) |
| **Trigger** | Dispatch from prd-decomposer or pr-review-submit, daily schedule, `/repo-assist` command |
| **Output** | Up to 4 PRs per run |

Runs a 5-task cycle each invocation:

1. **Implement issues** — picks unblocked pipeline issues, creates branches from `main`, writes code, runs tests, opens PRs with `Closes #N`
2. **Maintain PRs** — fixes CI failures and merge conflicts on open pipeline PRs
3. **Unblock dependents** — comments on issues whose dependencies have resolved
4. **Handle review feedback** — implements requested changes from pr-review-agent
5. **Update status** — maintains a rolling status issue with progress table

Persists memory on an orphan branch (`memory/repo-assist`) to track attempted
issues, outcomes, and backlog state across runs.

### pr-review-agent + pr-review-submit

The PR reviewer is split into two workflows to preserve **identity separation**:

#### pr-review-agent

| | |
|---|---|
| **File** | `.github/workflows/pr-review-agent.md` |
| **Engine** | Copilot (gpt-5) — full 64K-128K+ context window |
| **Trigger** | Automatic on PR opened/updated/ready; `workflow_dispatch` |
| **Output** | Verdict comment on the PR (starting with `<!-- pr-review-verdict -->`) |

Agentic workflow that runs as the Copilot app identity. Reads the **full PR diff**
(no truncation), linked issue acceptance criteria, CI status, and AGENTS.md. Posts
a structured verdict comment — does NOT submit a formal GitHub review.

Review process:
1. Reads AGENTS.md for project context and coding standards
2. Reads the full PR diff via `gh pr diff` (no truncation — full Copilot context window)
3. Reads the PR description and extracts linked issue number from `Closes #N`
4. Reads acceptance criteria from the linked issue
5. Checks CI status via `gh pr checks`
6. Reviews against: acceptance criteria, correctness, security, scope, code quality, tests
7. Posts verdict comment with `<!-- pr-review-verdict -->` marker and `VERDICT: APPROVE` or `VERDICT: REQUEST_CHANGES`

Decision rules:
- **APPROVE**: all acceptance criteria met, no bugs/security issues, code is in scope
- **REQUEST_CHANGES**: any criteria not met, bugs/security issues, or out-of-scope changes
- **CI failing**: always REQUEST_CHANGES
- **Minor style issues**: not grounds for REQUEST_CHANGES (be pragmatic)

#### pr-review-submit

| | |
|---|---|
| **File** | `.github/workflows/pr-review-submit.yml` |
| **Engine** | Standard GitHub Actions (`github-actions[bot]`) |
| **Trigger** | `issue_comment: created` — fires when pr-review-agent posts its verdict |
| **Output** | Formal APPROVE or REQUEST_CHANGES GitHub review; auto-merge; repo-assist dispatch |

Standard workflow that runs as `github-actions[bot]`. Watches for comments containing
`<!-- pr-review-verdict -->` on PRs, parses the verdict, and submits the formal GitHub
review. This is the identity that satisfies GitHub's self-approval restriction.

Submit process:
1. Detects verdict comment via `<!-- pr-review-verdict -->` marker
2. Fetches comment body via API (avoids shell injection — never uses `${{ github.event.comment.body }}` in run blocks)
3. Parses `VERDICT: APPROVE` or `VERDICT: REQUEST_CHANGES` — defaults to REQUEST_CHANGES if unparseable
4. Submits formal GitHub review as `github-actions[bot]`
5. On APPROVE of `[Pipeline]` PRs: marks draft ready, enables auto-merge (squash)
6. After review: checks for remaining pipeline issues, dispatches `repo-assist` (APPROVE) or posts `/repo-assist` on linked issue (REQUEST_CHANGES)

### pipeline-status

| | |
|---|---|
| **File** | `.github/workflows/pipeline-status.md` |
| **Engine** | Copilot (gpt-5) |
| **Trigger** | Daily schedule |
| **Output** | Updated status issue |

Read-only reporting workflow. Scans all pipeline issues and PRs, categorizes them
(open, in-progress, blocked, completed), and updates a single `[Pipeline] Status`
issue with a summary table.

### close-issues

| | |
|---|---|
| **File** | `.github/workflows/close-issues.yml` |
| **Engine** | Standard GitHub Actions |
| **Trigger** | `pull_request: closed` (merged only) |
| **Output** | Closes linked issues via `gh issue close` |

Dedicated workflow for closing issues referenced by `Closes #N` (and variants) in
merged PR bodies. Isolated from pr-review-submit with its own concurrency group
(`close-issues-{PR_NUMBER}`, `cancel-in-progress: false`) to prevent the job from
being cancelled by concurrent workflow runs.

Fetches the PR body via `gh pr view` (not `${{ github.event.pull_request.body }}`)
to avoid script injection vulnerabilities.

### pipeline-watchdog

| | |
|---|---|
| **File** | `.github/workflows/pipeline-watchdog.yml` |
| **Engine** | Standard GitHub Actions |
| **Trigger** | Cron (every 30 minutes), manual dispatch |
| **Output** | `/repo-assist` comments or `repo-assist` dispatches |

Cron-based stall detector that replaces the human supervisor. Detects two failure modes:

1. **Stalled PRs** — Open `[Pipeline]` PRs with a `CHANGES_REQUESTED` review and no
   activity for 30+ minutes. Posts `/repo-assist` on the linked issue with fix instructions.
2. **Orphaned issues** — Open pipeline issues with no linked open PR and no activity
   for 30+ minutes. Dispatches `repo-assist.lock.yml` in Scheduled Mode.

Safety mechanisms:
- Skips all dispatches if repo-assist is already running (prevents flooding)
- One action per cycle (stalled PR takes priority over orphaned issue)
- Concurrency group `pipeline-watchdog` with `cancel-in-progress: false`
- Posts completion notice on status issue when all pipeline items are resolved

## Key Design Decisions

**Squash merge with PR_BODY** — The repo is configured so squash merge commits
use the PR body as the commit message. Since repo-assist writes `Closes #N` in
every PR body, squash merging preserves the issue reference. However, `GITHUB_TOKEN`
cannot trigger the `Closes #N` auto-close — the dedicated `close-issues` workflow
handles issue closing explicitly after each merge.

**Orphan branch memory** — repo-assist stores state in a JSON file on the
`memory/repo-assist` orphan branch. This persists across workflow runs without
polluting the main branch history.

**Full context review** — pr-review-agent uses the Copilot engine (gpt-5) with a
64K-128K+ context window and reads the full PR diff via `gh pr diff` with no
truncation. This eliminates false "missing files" rejections that occurred with the
previous GitHub Models API approach (4K token limit, 300-line truncation).
Unrecognized verdicts default to REQUEST_CHANGES (fail-safe).

**Identity separation** — Agentic workflows run under the Copilot app identity.
pr-review-submit runs under `github-actions[bot]`. This lets the reviewer approve PRs
created by the Copilot agent without violating GitHub's self-approval rules.
pr-review-agent (Copilot identity) posts only a verdict comment; pr-review-submit
(github-actions[bot] identity) submits the formal GitHub review.

**Re-dispatch loop** — After each merge, pr-review-submit checks for remaining open
issues and re-dispatches repo-assist. This creates a continuous loop that runs
until all issues from the PRD are implemented.

## Secrets

| Secret | Purpose |
|--------|---------|
| `GH_AW_GITHUB_TOKEN` | Token for gh-aw agentic workflow engine |
| `COPILOT_GITHUB_TOKEN` | Copilot agent token |

Note: `MODELS_TOKEN` is no longer required — pr-review-agent uses the Copilot engine
directly instead of the GitHub Models REST API.

## Repo Settings

Configured by `scripts/bootstrap.sh` and manual ruleset setup:

- Squash merge commit message: `PR_BODY` (preserves `Closes #N`)
- Allow auto-merge: enabled
- Ruleset "Protect main": 1 required review + `review` status check, squash-only, admin bypass
