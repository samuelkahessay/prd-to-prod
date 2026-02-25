# Agentic Pipeline Design v2

**Date:** 2026-02-24
**Status:** Approved
**Approach:** gh-aw (GitHub Agentic Workflows) + Copilot engine
**Supersedes:** v1 (Copilot SDK Orchestrator approach)

---

## Goal

Build a fully autonomous GitHub development pipeline where:

1. A PRD is decomposed into GitHub Issues via an AI-powered `gh-aw` workflow
2. A repo-assist workflow autonomously picks up issues, writes code, and opens draft PRs
3. Humans review and merge; the pipeline tracks progress end-to-end

Human role: write PRDs, review PRs, click merge.

---

## Why gh-aw Over Copilot SDK

| Concern | Copilot SDK (v1) | gh-aw (v2) |
|---|---|---|
| Custom code | ~15 TypeScript files | ~3 markdown files |
| Infrastructure | Requires local CLI process | Runs in GitHub Actions |
| Security | Manual auth + permissions | Sandboxed, read-only default, safe-outputs |
| Maintenance | SDK in tech preview, APIs may break | Standard GitHub Actions |
| Memory | Must build state tracking | Built-in `repo-memory` tool |
| Agent execution | Must spawn Copilot CLI | Native Copilot engine integration |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     GITHUB.COM                          │
│                                                         │
│  .github/workflows/                                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ prd-decomposer.md          (gh-aw workflow)      │   │
│  │ Trigger: /decompose <url>  or push to docs/prd/  │   │
│  │ Reads PRD → creates issues with acceptance criteria│  │
│  │ Labels: feature, test, infra, docs                │   │
│  │ Safe-outputs: create-issue, add-labels            │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│                  Creates issues                         │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ repo-assist.md             (gh-aw workflow)      │   │
│  │ Trigger: daily schedule + /repo-assist            │   │
│  │ Picks up issues → writes code → opens draft PRs  │   │
│  │ Manages own PRs (CI fixes, conflict resolution)  │   │
│  │ Uses persistent repo-memory across runs          │   │
│  │ Safe-outputs: create-pull-request, push, comment │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│                  Opens draft PRs                        │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ pipeline-status.md         (gh-aw workflow)      │   │
│  │ Trigger: daily schedule                          │   │
│  │ Reports pipeline progress as issue update        │   │
│  │ Tracks: open issues, open PRs, merged, blocked   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  .github/                                               │
│    copilot-instructions.md    ← Agent reads this        │
│    copilot-setup-steps.yml    ← Agent dev environment   │
│                                                         │
│  docs/prd/                                              │
│    sample-prd.md              ← Drop PRDs here          │
└─────────────────────────────────────────────────────────┘
```

---

## Workflows

### 1. `prd-decomposer.md` — PRD → Issues

**Trigger:** `/decompose` slash command on any issue, or push to `docs/prd/`

**What it does:**
1. Reads the PRD content (from issue body, comment, or committed file)
2. Decomposes into atomic development tasks (1-4 hours each)
3. Creates GitHub Issues with:
   - Clear title
   - Acceptance criteria as checklist
   - Dependency references (`Depends on #N`)
   - Labels by type (feature, test, infra, docs)
4. Posts a summary comment with the task breakdown

**Safe-outputs:**
- `create-issue`: max 20, title prefix `[Pipeline]`, labels restricted
- `add-comment`: max 5
- `add-labels`: restricted to pipeline labels

**Tools:** `bash`, `github` (issues toolset)

### 2. `repo-assist.md` — Issues → Code → PRs

Fork of `githubnext/agentics/repo-assist` customized for our pipeline.

**Trigger:** Daily schedule + `/repo-assist` slash command

**What it does:**
1. Reads persistent memory for state
2. Scans issues labeled `feature`, `test`, `infra`, `docs`
3. For each fixable/implementable issue:
   - Creates branch `repo-assist/issue-<N>-<desc>`
   - Implements the feature/fix
   - Runs tests
   - Opens draft PR with `Closes #N`
4. Maintains existing PRs (CI fixes, conflict resolution)
5. Updates memory with progress

**Safe-outputs:**
- `create-pull-request`: max 4, draft, title prefix `[Pipeline]`
- `push-to-pull-request-branch`: max 4
- `add-comment`: max 10
- `create-issue`: max 2 (for sub-tasks discovered during work)
- `add-labels`: restricted set

**Tools:** `bash`, `web-fetch`, `github` (all toolsets), `repo-memory`

### 3. `pipeline-status.md` — Progress Dashboard

**Trigger:** Daily schedule

**What it does:**
1. Counts issues by label/state
2. Lists open PRs from the pipeline
3. Updates a single rolling status issue `[Pipeline] Status`
4. Identifies blocked issues (dependencies not met)

**Safe-outputs:**
- `update-issue`: max 1, target `[Pipeline] Status`
- `create-issue`: max 1 (for the initial status issue)

---

## Repository Structure

```
agentic-pipeline/
├── .github/
│   ├── copilot-instructions.md             # Agent coding context
│   ├── copilot-setup-steps.yml             # Agent dev environment
│   └── workflows/
│       ├── prd-decomposer.md               # PRD → Issues workflow
│       ├── prd-decomposer.md.lock.yml      # Compiled Actions YAML
│       ├── repo-assist.md                  # Issues → PRs workflow
│       ├── repo-assist.md.lock.yml         # Compiled Actions YAML
│       ├── pipeline-status.md              # Progress dashboard
│       └── pipeline-status.md.lock.yml     # Compiled Actions YAML
├── docs/
│   ├── prd/
│   │   └── sample-prd.md                   # Example PRD
│   └── plans/
│       └── *.md                            # Design docs
├── scripts/
│   └── bootstrap.sh                        # One-time setup script
├── AGENTS.md                               # Project context for all agents
└── README.md
```

---

## Prerequisites

| Requirement | Verification |
|---|---|
| GitHub CLI v2.0+ | `gh --version` |
| gh-aw extension | `gh extension install github/gh-aw` |
| Copilot subscription | Account has Copilot Pro+ or Business |
| GitHub Actions enabled | Repo Settings → Actions → Enabled |
| Write access to repo | Can push to main |

---

## Pipeline Flow

```
HUMAN: Writes PRD → pushes to docs/prd/ (or posts /decompose)
              ↓
prd-decomposer.md (gh-aw workflow)
  AI reads PRD
  Creates 5-10 GitHub Issues
  Labels them (feature, test, infra)
  Posts summary comment
              ↓
repo-assist.md (gh-aw workflow, daily + on-demand)
  Scans labeled issues
  For each implementable issue:
    Creates branch
    Writes code
    Runs tests
    Opens draft PR (Closes #N)
  Maintains existing PRs (CI fixes)
              ↓
HUMAN: Reviews draft PRs
  Approve → merge (issue auto-closes via "Closes #N")
  Request changes → agent iterates next run
              ↓
pipeline-status.md (gh-aw workflow, daily)
  Updates rolling status issue
  Shows: X issues open, Y PRs in review, Z completed
              ↓
CYCLE REPEATS until all issues closed
```

---

## Setup Steps

1. Create a new public GitHub repo
2. Install gh-aw: `gh extension install github/gh-aw`
3. Run `gh aw init` in the repo
4. Add the 3 workflow markdown files
5. Run `gh aw compile` to generate lock files
6. Configure Copilot as the AI engine
7. Push a sample PRD to test
8. Trigger: `gh aw run prd-decomposer`
9. Watch issues get created
10. Trigger: `gh aw run repo-assist`
11. Watch PRs get opened
12. Review and merge

---

## Known Limitations

1. **gh-aw in tech preview** — may change, but backed by GitHub
2. **Agent task complexity** — best for well-specified 1-4 hour tasks
3. **Daily schedule** — repo-assist runs daily by default, not instantly on issue creation
4. **Draft PRs** — all agent PRs are drafts requiring human review
5. **Safe-output limits** — max 4 PRs per run, max 20 issues per decomposition
6. **Copilot subscription required** — Pro+ or Business plan

---

## Phase 2 Enhancements

1. Add `pr-fix.md` workflow for automated CI failure fixes
2. Add `issue-triage.md` for auto-labeling incoming issues
3. Add `grumpy-reviewer.md` for automated code review
4. Slack notifications via custom safe-output webhook
5. Multi-repo pipeline (decompose once, distribute across repos)
6. Custom MCP servers for domain-specific context
