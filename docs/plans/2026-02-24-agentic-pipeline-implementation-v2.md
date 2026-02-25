# Agentic Pipeline Implementation Plan v2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous PRD-to-PR pipeline using gh-aw (GitHub Agentic Workflows) with 3 markdown workflows and zero custom infrastructure.

**Architecture:** gh-aw workflows running in GitHub Actions with Copilot engine. PRD decomposer creates issues, repo-assist implements them as PRs.

**Tech Stack:** gh-aw CLI, GitHub Actions, Copilot engine, markdown workflow definitions

**Design doc:** `docs/plans/2026-02-24-agentic-pipeline-design-v2.md`

---

## Task 1: Create Public GitHub Repository

**Step 1: Initialize and push to GitHub**

Run: `gh repo create agentic-pipeline --public --source=. --push`

Expected: Repo created at `https://github.com/<user>/agentic-pipeline`

**Step 2: Verify**

Run: `gh repo view --web`
Expected: Opens repo in browser

**Step 3: Commit**

Already pushed by `--push` flag.

---

## Task 2: Install gh-aw and Initialize

**Step 1: Install the gh-aw extension**

Run: `gh extension install github/gh-aw`
Expected: Extension installed successfully

**Step 2: Verify installation**

Run: `gh aw version`
Expected: Shows version number

**Step 3: Initialize gh-aw in the repo**

Run: `gh aw init`
Expected: Interactive setup, creates base configuration

**Step 4: Commit any generated files**

```bash
git add -A
git commit -m "chore: initialize gh-aw"
git push
```

---

## Task 3: Write AGENTS.md

This file provides project context to all gh-aw agents.

**Files:**
- Create: `AGENTS.md`

**Step 1: Write the file**

```markdown
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
```

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md for gh-aw agent context"
git push
```

---

## Task 4: Write the PRD Decomposer Workflow

**Files:**
- Create: `.github/workflows/prd-decomposer.md`

**Step 1: Write the workflow markdown**

```markdown
---
description: |
  Decomposes a Product Requirements Document (PRD) into atomic GitHub Issues.
  Each issue gets clear acceptance criteria, dependency references, and type labels.
  Triggered by the /decompose command on any issue or discussion containing a PRD.

on:
  slash_command:
    name: decompose
  reaction: "eyes"

timeout-minutes: 15

permissions: read-all

network: defaults

safe-outputs:
  create-issue:
    title-prefix: "[Pipeline] "
    labels: [feature, test, infra, docs, bug, pipeline]
    max: 20
  add-comment:
    max: 5
  add-labels:
    allowed: [feature, test, infra, docs, bug, pipeline, blocked, ready]
    max: 40

tools:
  bash: true
  github:
    toolsets: [issues, labels]

---

# PRD Decomposer

You are a senior technical project manager. Your job is to read a Product Requirements Document (PRD) and decompose it into atomic, well-specified GitHub Issues that a coding agent can implement independently.

## Instructions

"${{ steps.sanitized.outputs.text }}"

If the instructions above contain a URL or file path, fetch/read that content as the PRD. If the instructions are empty, read the body of issue #${{ github.event.issue.number }} as the PRD.

## Decomposition Rules

1. **Read the PRD carefully.** Understand the full scope before creating any issues.

2. **Identify task dependencies.** Some tasks must be done before others (e.g., scaffold before features, features before tests).

3. **Create atomic issues.** Each issue should be:
   - Completable by one developer in 1-4 hours
   - Self-contained with all context needed to implement
   - Testable with clear acceptance criteria

4. **For each issue, include:**
   - A clear, descriptive title
   - A `## Description` section explaining what to build and why
   - A `## Acceptance Criteria` section as a markdown checklist
   - A `## Dependencies` section listing issue numbers that must be completed first (use "Depends on [Pipeline] <title>" for issues being created in this batch — the agent will resolve numbers)
   - A `## Technical Notes` section with relevant file paths, API signatures, or architectural guidance

5. **Label each issue** with exactly one type: `feature`, `test`, `infra`, or `docs`.

6. **Create issues in dependency order:** infrastructure first, then core features, then dependent features, then tests/docs last.

7. **Add the `pipeline` label** to all issues so they can be tracked.

## Output Format

After creating all issues, post a summary comment on the original issue/discussion with:

```
## Pipeline Tasks Created

| # | Title | Type | Depends On |
|---|-------|------|------------|
| #1 | ... | infra | — |
| #2 | ... | feature | #1 |
...

Total: N issues created. Run `/repo-assist` to start implementation.
```

## Quality Checklist

Before creating each issue, verify:
- [ ] Title is specific (not "Implement feature 1")
- [ ] Acceptance criteria are testable (not "works correctly")
- [ ] Dependencies are accurate
- [ ] Technical notes reference actual project patterns
- [ ] Issue is small enough for a single PR
```

**Step 2: Compile the workflow**

Run: `gh aw compile`
Expected: Creates `.github/workflows/prd-decomposer.md.lock.yml`

**Step 3: Commit**

```bash
git add .github/workflows/prd-decomposer.md .github/workflows/prd-decomposer.md.lock.yml
git commit -m "feat: add PRD decomposer gh-aw workflow"
git push
```

---

## Task 5: Write the Repo Assist Workflow

**Files:**
- Create: `.github/workflows/repo-assist.md`

This is a customized fork of `githubnext/agentics/repo-assist` focused on our pipeline.

**Step 1: Write the workflow markdown**

```markdown
---
description: |
  Autonomous repository assistant that implements issues as pull requests.
  Scans for pipeline issues, writes code, runs tests, and opens draft PRs.
  Also maintains its own PRs by fixing CI failures and resolving merge conflicts.
  Can be triggered on-demand via /repo-assist <instructions>.

on:
  schedule: daily
  workflow_dispatch:
  slash_command:
    name: repo-assist
  reaction: "eyes"

timeout-minutes: 60

permissions: read-all

network:
  allowed:
  - defaults
  - node
  - python

safe-outputs:
  create-pull-request:
    draft: true
    title-prefix: "[Pipeline] "
    labels: [automation, pipeline]
    max: 4
  push-to-pull-request-branch:
    target: "*"
    title-prefix: "[Pipeline] "
    max: 4
  add-comment:
    max: 10
    target: "*"
    hide-older-comments: true
  create-issue:
    title-prefix: "[Pipeline] "
    labels: [automation, pipeline]
    max: 2
  add-labels:
    allowed: [feature, test, infra, docs, bug, pipeline, blocked, ready, in-progress, completed]
    max: 20
    target: "*"
  remove-labels:
    allowed: [ready, in-progress, blocked]
    max: 10
    target: "*"

tools:
  web-fetch:
  github:
    toolsets: [all]
  bash: true
  repo-memory: true

---

# Pipeline Repo Assist

## Command Mode

Take heed of **instructions**: "${{ steps.sanitized.outputs.text }}"

If these are non-empty, follow the user's instructions instead of the normal workflow. Apply all the same guidelines (read AGENTS.md, run tests, use AI disclosure). Skip the scheduled workflow and directly do what was requested. Then exit.

## Scheduled Mode

You are the Pipeline Assistant for `${{ github.repository }}`. Your job is to implement issues created by the PRD Decomposer as pull requests.

Always:
- **Read AGENTS.md first** for project context, coding standards, and build commands
- **Be surgical** — only change what's needed for the issue
- **Test everything** — never create a PR if tests fail due to your changes
- **Disclose your nature** — identify yourself as Pipeline Assistant in all comments
- **Respect scope** — don't refactor code outside the issue scope

## Memory

Use persistent repo memory to track:
- Issues already attempted (with outcomes)
- PRs created and their status
- A backlog cursor for round-robin processing
- Which tasks were last worked on (timestamps)
- Dependency resolution state

Read memory at the **start** of every run; update at the **end**.
Memory may be stale — always verify against current repo state.

## Workflow

Each run, work on 2-4 tasks from the list below. Use round-robin scheduling based on memory. Always do Task 5 (status update).

### Task 1: Implement Issues as Pull Requests

1. List open issues labeled `pipeline` + (`feature`, `test`, `infra`, or `docs`).
2. Sort by dependency order — skip issues whose dependencies (referenced in issue body) are not yet closed.
3. For each implementable issue (check memory — skip if already attempted):
   a. Read the issue carefully, including acceptance criteria and technical notes.
   b. Create a fresh branch off `main`: `repo-assist/issue-<N>-<short-desc>`.
   c. Set up the development environment as described in AGENTS.md.
   d. Implement the feature/task described in the issue. Follow acceptance criteria exactly.
   e. **Build and test (required)**: Run the build and test commands from AGENTS.md. Do not create a PR if tests fail due to your changes.
   f. Add tests if the issue type is `feature` or `infra` and tests aren't explicitly excluded.
   g. Create a draft PR with:
      - Title matching the issue title
      - Body containing: `Closes #N`, description of changes, and test results
      - AI disclosure: "This PR was created by Pipeline Assistant."
   h. Label the source issue `in-progress`.
4. Update memory with attempts and outcomes.

### Task 2: Maintain Pipeline Pull Requests

1. List all open PRs with the `[Pipeline]` title prefix.
2. For each PR:
   - If CI is failing due to your changes: fix and push.
   - If there are merge conflicts: resolve and push.
   - If CI failed 3+ times: comment and leave for human review.
3. Do not modify PRs waiting on human review with no CI failures.
4. Update memory.

### Task 3: Unblock Dependent Issues

1. Check if any closed issues unblock dependent issues.
2. For newly unblocked issues, add a comment: "Dependencies resolved. This issue is ready for implementation."
3. Update memory with dependency state.

### Task 4: Handle Review Feedback

1. List open PRs with review comments or change requests.
2. For each PR with actionable feedback:
   - Read the review comments
   - Implement the requested changes
   - Push to the PR branch
   - Comment summarizing what was changed
3. Update memory.

### Task 5: Update Pipeline Status (ALWAYS DO THIS)

Maintain a single open issue titled `[Pipeline] Status` as a rolling summary:

```
## Pipeline Status — Updated YYYY-MM-DD

| Stage | Count |
|-------|-------|
| Open Issues | X |
| In Progress | Y |
| PRs In Review | Z |
| Completed | W |

### Recent Activity
- Implemented #N: <title> → PR #M
- ...

### Blocked
- #N: Waiting on #M (dependency)
- ...

### Next Up
- #N: <title> (ready to implement)
```

Update this issue every run.
```

**Step 2: Compile the workflow**

Run: `gh aw compile`
Expected: Creates `.github/workflows/repo-assist.md.lock.yml`

**Step 3: Commit**

```bash
git add .github/workflows/repo-assist.md .github/workflows/repo-assist.md.lock.yml
git commit -m "feat: add repo-assist gh-aw workflow for autonomous PR creation"
git push
```

---

## Task 6: Write the Pipeline Status Workflow

**Files:**
- Create: `.github/workflows/pipeline-status.md`

**Step 1: Write the workflow markdown**

```markdown
---
description: |
  Daily pipeline progress report. Creates and updates a rolling status issue
  tracking all pipeline issues and PRs.

on:
  schedule: daily

timeout-minutes: 5

permissions: read-all

safe-outputs:
  update-issue:
    target: "[Pipeline] Status"
    max: 1
  create-issue:
    title-prefix: "[Pipeline] "
    labels: [pipeline, report]
    max: 1

tools:
  github:
    toolsets: [issues, pull_requests]

---

# Pipeline Status Report

You are a pipeline status reporter for `${{ github.repository }}`.

## Task

1. List all issues labeled `pipeline`.
2. List all open PRs with `[Pipeline]` in the title.
3. Categorize:
   - **Open Issues**: Not yet started (no linked PR)
   - **In Progress**: Has an open PR or labeled `in-progress`
   - **In Review**: PR is open and has been reviewed
   - **Completed**: Issue is closed
   - **Blocked**: Issue has unmet dependencies (check issue body for "Depends on #N" where #N is still open)

4. Find or create the `[Pipeline] Status` issue.

5. Update its body with:

```
## Pipeline Status — YYYY-MM-DD

### Summary
- Total tasks: N
- Completed: X (Y%)
- In progress: Z
- Blocked: W

### Task Board

| Issue | Title | Status | PR |
|-------|-------|--------|----|
| #1 | ... | Completed | #10 |
| #2 | ... | In Review | #11 |
| #3 | ... | Blocked (#2) | — |
...

### Blocked Issues
List each blocked issue and what it's waiting on.

### Next Actions
List issues ready to be implemented (all dependencies met, no PR yet).
```
```

**Step 2: Compile**

Run: `gh aw compile`

**Step 3: Commit**

```bash
git add .github/workflows/pipeline-status.md .github/workflows/pipeline-status.md.lock.yml
git commit -m "feat: add pipeline status gh-aw workflow"
git push
```

---

## Task 7: Agent Configuration Files

**Files:**
- Create: `.github/copilot-instructions.md`
- Create: `.github/copilot-setup-steps.yml`

**Step 1: Create copilot-instructions.md**

```markdown
# Copilot Agent Instructions

## Project Overview
This project uses an agentic pipeline where issues are auto-generated from PRDs
and implemented by AI agents. Follow AGENTS.md for coding standards.

## Build & Test
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

## Definition of Done
1. Code compiles without errors
2. All tests pass
3. New tests for new functionality
4. PR body includes `Closes #N`
5. PR description explains changes

## Restrictions
- Do not modify .github/workflows/ files
- Do not add dependencies without noting in PR
- Do not refactor outside issue scope
```

**Step 2: Create copilot-setup-steps.yml**

```yaml
name: Copilot Setup Steps

on:
  workflow_call:

jobs:
  copilot-setup-steps:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci || echo "No package-lock.json yet"
```

**Step 3: Commit**

```bash
git add .github/copilot-instructions.md .github/copilot-setup-steps.yml
git commit -m "feat: add Copilot agent configuration"
git push
```

---

## Task 8: Bootstrap Script

**Files:**
- Create: `scripts/bootstrap.sh`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Agentic Pipeline Bootstrap ==="

# Check prerequisites
command -v gh >/dev/null 2>&1 || { echo "ERROR: GitHub CLI (gh) not installed"; exit 1; }
gh aw version >/dev/null 2>&1 || { echo "ERROR: gh-aw not installed. Run: gh extension install github/gh-aw"; exit 1; }

# Create labels
echo "Creating labels..."
for label in "pipeline:0075ca:Pipeline-managed issue" \
             "feature:a2eeef:New feature" \
             "test:7057ff:Test coverage" \
             "infra:fbca04:Infrastructure" \
             "docs:0075ca:Documentation" \
             "bug:d73a4a:Bug fix" \
             "automation:e4e669:Created by automation" \
             "in-progress:d93f0b:Work in progress" \
             "blocked:b60205:Blocked by dependency" \
             "ready:0e8a16:Ready for implementation" \
             "completed:0e8a16:Completed and merged" \
             "report:c5def5:Status report"; do
  IFS=: read -r name color desc <<< "$label"
  gh label create "$name" --color "$color" --description "$desc" --force 2>/dev/null || true
done
echo "Labels created."

# Compile workflows
echo "Compiling gh-aw workflows..."
gh aw compile
echo "Workflows compiled."

# Configure secrets reminder
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Ensure GitHub Copilot is configured as the AI engine"
echo "   Run: gh aw secrets bootstrap"
echo "2. Push changes: git push"
echo "3. Test the pipeline:"
echo "   - Create an issue with a PRD, then comment /decompose"
echo "   - Or run: gh aw run prd-decomposer"
```

**Step 2: Make executable**

Run: `chmod +x scripts/bootstrap.sh`

**Step 3: Commit**

```bash
git add scripts/bootstrap.sh
git commit -m "feat: add bootstrap script for one-time setup"
git push
```

---

## Task 9: Sample PRD

**Files:**
- Create: `docs/prd/sample-prd.md`

**Step 1: Write the sample PRD**

```markdown
# PRD: Task Management API

## Overview
Build a simple REST API for managing tasks. This is a test project for the
agentic pipeline — the repo-assist workflow will implement each feature.

## Tech Stack
- Runtime: Node.js 20+
- Framework: Express.js
- Language: TypeScript
- Testing: Vitest
- Storage: In-memory (Map)

## Features

### Feature 1: Project Scaffold
Set up the Express + TypeScript project with a health check endpoint.

**Acceptance Criteria:**
- [ ] package.json with Express, TypeScript, Vitest
- [ ] tsconfig.json for ES modules
- [ ] src/app.ts with Express app
- [ ] src/server.ts listening on PORT (default 3000)
- [ ] GET /health returns { status: "ok" }
- [ ] Test for health endpoint

### Feature 2: Create Task
POST /tasks — create a new task.

**Acceptance Criteria:**
- [ ] Request: { title: string, description?: string }
- [ ] Response 201: { id, title, description, status: "todo", createdAt }
- [ ] Response 400 if title missing
- [ ] Unique ID generation
- [ ] Tests for success and validation

### Feature 3: List Tasks
GET /tasks — list all tasks.

**Acceptance Criteria:**
- [ ] Response 200: { tasks: [...] }
- [ ] Support ?status=todo|in_progress|done filter
- [ ] Empty array when no tasks
- [ ] Tests for filtered and unfiltered

### Feature 4: Update Task Status
PATCH /tasks/:id — update status.

**Acceptance Criteria:**
- [ ] Request: { status: "todo" | "in_progress" | "done" }
- [ ] Response 200 with updated task
- [ ] Response 404 if not found
- [ ] Response 400 if invalid status
- [ ] Tests for all cases

### Feature 5: Delete Task
DELETE /tasks/:id — remove a task.

**Acceptance Criteria:**
- [ ] Response 204 on success
- [ ] Response 404 if not found
- [ ] Tests for both cases

## Non-Functional Requirements
- JSON responses with Content-Type header
- Error format: { error: string }
- No authentication needed

## Out of Scope
- Database / persistent storage
- Authentication
- Deployment
```

**Step 2: Commit**

```bash
git add docs/prd/sample-prd.md
git commit -m "docs: add sample PRD for pipeline testing"
git push
```

---

## Task 10: README

**Files:**
- Create: `README.md`

**Step 1: Write the README**

```markdown
# Agentic Pipeline

Autonomous GitHub development pipeline powered by [gh-aw](https://github.com/github/gh-aw).

Write a PRD → AI decomposes it into issues → AI implements each issue → Draft PRs open for review.

## How It Works

1. **You write a PRD** and push it to `docs/prd/`, or paste it in an issue
2. **`/decompose`** — AI reads the PRD, creates GitHub Issues with acceptance criteria
3. **`repo-assist`** — AI picks up issues daily, writes code, opens draft PRs
4. **You review** and merge. Pipeline tracks progress via a status dashboard.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USER/agentic-pipeline.git
cd agentic-pipeline

# 2. Install gh-aw
gh extension install github/gh-aw

# 3. Bootstrap (creates labels, compiles workflows)
bash scripts/bootstrap.sh

# 4. Configure AI engine
gh aw secrets bootstrap

# 5. Push
git push

# 6. Test: create an issue with the sample PRD content, then comment:
#    /decompose
#
# Or trigger directly:
#    gh aw run prd-decomposer
```

## Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `prd-decomposer` | `/decompose` command | Parses PRD → creates issues |
| `repo-assist` | Daily + `/repo-assist` | Implements issues → opens PRs |
| `pipeline-status` | Daily | Updates progress dashboard |

## Requirements

- GitHub account with Copilot subscription
- GitHub CLI (`gh`) v2.0+
- `gh-aw` extension installed

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
git push
```

---

## Task 11: End-to-End Smoke Test

**Step 1: Run bootstrap**

Run: `bash scripts/bootstrap.sh`
Expected: Labels created, workflows compiled

**Step 2: Push everything**

Run: `git push`

**Step 3: Verify workflows are registered**

Run: `gh aw status`
Expected: Shows 3 workflows (prd-decomposer, repo-assist, pipeline-status)

**Step 4: Create a test issue with PRD content**

Run: `gh issue create --title "PRD: Task Management API" --body-file docs/prd/sample-prd.md`
Expected: Issue created

**Step 5: Trigger decomposition**

Comment `/decompose` on the issue, or run:
Run: `gh aw run prd-decomposer`
Expected: Workflow runs, creates 5-6 issues from the PRD

**Step 6: Verify issues**

Run: `gh issue list --label pipeline`
Expected: Shows issues created by the decomposer

**Step 7: Trigger repo-assist**

Run: `gh aw run repo-assist`
Expected: Workflow runs, picks up first issue(s), creates draft PR(s)

**Step 8: Verify PRs**

Run: `gh pr list`
Expected: Shows draft PR(s) from the pipeline

**Step 9: Celebrate**

The pipeline is live. Issues become PRs autonomously.
