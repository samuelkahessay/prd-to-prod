---
description: |
  Daily pipeline progress report. Creates and updates a rolling status issue
  tracking all pipeline issues and PRs.

on:
  schedule: daily

if: ${{ github.event_name != 'schedule' || vars.PIPELINE_ENABLED == 'true' }}

timeout-minutes: 10

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"

network:
  allowed:
    - defaults

permissions: read-all

safe-outputs:
  update-issue:
    target: "*"
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
   - **Traceability Gap**: Issue is missing a `## PRD Traceability` section

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

### Traceability Gaps
List each open pipeline issue missing `## PRD Traceability`.

### Next Actions
List issues ready to be implemented (all dependencies met, no PR yet).
```
