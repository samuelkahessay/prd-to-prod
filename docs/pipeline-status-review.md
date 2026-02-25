# Pipeline Status Review — 2026-02-25

## Pipeline Observatory (Run 2) — COMPLETE

All **10/10 features shipped** and merged to main:

| PR | Feature | Status |
|---|---|---|
| #40 | Project Scaffold (Next.js 14, TS, Tailwind, Vitest) | Merged |
| #42 | Static Fixture Data & Data Loading Layer | Merged |
| #46 | Navigation Bar and Landing Page | Merged |
| #47 | Interactive SVG Node Graph | Merged |
| #48 | Horizontal Scrollable Timeline | Merged |
| #49 | Pipeline Cycle Cards + AI Review Inspector | Merged |
| #50 | Failure Timeline | Merged |
| #51 | Event Detail Panel + Playback Controls | Merged |
| #52 | Node Detail Panels with Slide-Down | Merged |
| #53 | Animated Message Particles (was #35) | Merged |

Two additional hardening PRs were also merged:
- **#54** — Fixed watchdog orphaned-issue parsing (unsafe shell word-splitting)
- **#55** — Hardened PR reviewer dispatch (review summary was leaking into shell context)

## Open Issues

Only 2 remain open:
- **#29** — PRD: Pipeline Observatory (parent PRD, can be closed since all features shipped)
- **#41** — [Pipeline] Status (pipeline status tracking issue)

## Active Failures

Three things are currently failing:

### 1. `Close Linked Issues` workflow — exit code 127

```
line 6: -: command not found
```

The PR body content is leaking into shell context (same class of bug that PR #55 fixed for the reviewer dispatch). The `PR_NUMBER` variable or the script context is getting corrupted.

### 2. `Pipeline Watchdog` workflow — failing

Two recent failures (16:42 and 18:03 today). PR #54 tried to fix the word-splitting issue but the failures continued.

### 3. `PR Reviewer` — one failure on the watchdog branch

Likely cascading from the above issues.

## Failure Playbook Summary

The playbook documents **20+ fixes** across two pipeline runs:

| Category | Count | Status |
|---|---|---|
| Resolved (permanently fixed) | 14 | All green |
| Self-healing (transient) | 2 | Acceptable |
| Still open | 2 | Active issues |

### Still open issues

1. **`close-issues` job unreliable** — Shell injection / parsing errors cause exit 127. The root cause keeps shifting: first it was concurrency group collisions, now it's dynamic content leaking into shell context. PRs #54 and #55 partially addressed this pattern but the close-issues job still fails.

2. **Watchdog workflow failing** — Newer addition, not yet in the playbook. Related to shell word-splitting in orphaned-issue detection.

## What's Next

1. **All 10 Observatory features are shipped** — this is done
2. **Close parent PRD issue #29** — can be done manually
3. **Connect repo to Vercel** for deployment (manual step)
4. **Fix the remaining shell-injection bugs** in close-issues and watchdog workflows
5. **Update the failure playbook** with the new failure modes from PRs #54/#55
