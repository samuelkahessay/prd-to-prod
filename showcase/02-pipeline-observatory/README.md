# Run 02 — Pipeline Observatory

**PRD**: [docs/prd/pipeline-observatory-prd.md](../../docs/prd/pipeline-observatory-prd.md)
**Tag**: [`v2.0.0`](https://github.com/samuelkahessay/agentic-pipeline/tree/v2.0.0)
**Deployment**: [prdtoprod.vercel.app](https://prdtoprod.vercel.app)
**Date**: February 2026

## Summary

A Next.js 14 dashboard that visualizes the agentic pipeline itself — interactive
simulator, timeline replay of real GitHub data, and forensic inspection of agent
decisions and failure patterns. 10 features decomposed from the PRD, all
autonomously implemented, reviewed, and merged. 32 Vitest tests. Deployed to
Vercel.

## Tech Stack

Next.js 14 (App Router), TypeScript (strict), Tailwind CSS (dark theme),
Framer Motion, @octokit/rest, Vitest + @testing-library/react

## Stats

| Metric | Value |
|--------|-------|
| Issues created | 12 |
| PRs merged | 19 (10 features + 9 hardening/bug fixes) |
| Tests written | 32 |
| Human code changes | 0 (app code), 3 (workflow fixes) |
| Pipeline fixes during run | 6 (shell injection, expression injection, concurrency, close-issues) |
| Views | Simulator, Replay, Forensics |

## Features

| PR | Feature | Status |
|----|---------|--------|
| [#40](https://github.com/samuelkahessay/agentic-pipeline/pull/40) | Project Scaffold (Next.js 14, TS, Tailwind, Vitest) | Merged |
| [#42](https://github.com/samuelkahessay/agentic-pipeline/pull/42) | Static Fixture Data & Data Loading Layer | Merged |
| [#46](https://github.com/samuelkahessay/agentic-pipeline/pull/46) | Navigation Bar and Landing Page | Merged |
| [#47](https://github.com/samuelkahessay/agentic-pipeline/pull/47) | Interactive SVG Node Graph | Merged |
| [#48](https://github.com/samuelkahessay/agentic-pipeline/pull/48) | Horizontal Scrollable Timeline | Merged |
| [#49](https://github.com/samuelkahessay/agentic-pipeline/pull/49) | Pipeline Cycle Cards + AI Review Inspector | Merged |
| [#50](https://github.com/samuelkahessay/agentic-pipeline/pull/50) | Failure Timeline | Merged |
| [#51](https://github.com/samuelkahessay/agentic-pipeline/pull/51) | Event Detail Panel + Playback Controls | Merged |
| [#52](https://github.com/samuelkahessay/agentic-pipeline/pull/52) | Node Detail Panels with Slide-Down | Merged |
| [#53](https://github.com/samuelkahessay/agentic-pipeline/pull/53) | Animated Message Particles | Merged |

## Hardening PRs

| PR | Fix |
|----|-----|
| [#54](https://github.com/samuelkahessay/agentic-pipeline/pull/54) | Watchdog orphaned-issue parsing (shell word-splitting) |
| [#55](https://github.com/samuelkahessay/agentic-pipeline/pull/55) | PR reviewer dispatch (review summary shell leak) |
| [#56](https://github.com/samuelkahessay/agentic-pipeline/pull/56) | Shell injection hardening + Octokit type fix |
| [#58](https://github.com/samuelkahessay/agentic-pipeline/pull/58) | Simulator graph scaling (agent-created from issue #57) |

## Pipeline Lessons

- **Shell injection is the #1 recurring failure mode**: PR body content reaching
  `bash` via `echo "$VAR" | grep` caused 6+ cascading failures across
  `close-issues`, `pr-reviewer`, and `pipeline-watchdog`. Root fix: use
  `--jq 'scan()'` so body content never touches a shell variable.
- **PAT `workflow` scope restriction is intentional**: The agent correctly cannot
  modify `.github/workflows/` files — this prevents self-modification loops.
  When workflow changes are needed, the agent creates a fallback issue with the
  patch embedded for human application.
- **`GITHUB_TOKEN` merges don't trigger `pull_request: closed`**: Bot merges
  using `GITHUB_TOKEN` don't propagate events, which is why we need the
  dedicated `close-issues.yml` workflow instead of relying on GitHub's
  built-in `Closes #N`.
- **Concurrency group isolation matters**: `close-issues` needed its own
  `close-issues-${{ PR_NUMBER }}` group separate from `pr-reviewer` to avoid
  being cancelled by overlapping runs.

## Restore Code

```bash
git checkout v2.0.0 -- src/ package.json tsconfig.json tailwind.config.ts \
  postcss.config.js next.config.js vitest.config.ts vercel.json next-env.d.ts
```
