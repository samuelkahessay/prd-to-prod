# Run 03 — DevCard

**PRD**: [docs/prd/devcard-prd.md](../../docs/prd/devcard-prd.md)
**Tag**: [`v3.0.0`](https://github.com/samuelkahessay/agentic-pipeline/tree/v3.0.0)
**Deployment**: [prdtoprod.vercel.app](https://prdtoprod.vercel.app)
**Date**: February 2026

## Summary

A developer identity card generator that fetches GitHub profile data and renders
shareable, themed cards with language breakdowns, top repositories, and export
options. Features a gallery of notable developers including Linus Torvalds, Dan
Abramov, and Peter Steinberger (OpenClaw). 10 features decomposed from the PRD,
all autonomously implemented, reviewed, and merged — plus 7 bug fixes filed and
resolved in a follow-up session.

## Tech Stack

Next.js 14 (App Router), TypeScript (strict), Tailwind CSS (dark theme),
Framer Motion, @octokit/rest, html-to-image, @vercel/og, Vitest + @testing-library/react

## Stats

| Metric | Value |
|--------|-------|
| Issues created | 17 (10 features + 7 bug fixes) |
| PRs merged | 22 (10 features + 12 fix PRs) |
| Tests written | 29 |
| Human code changes | 2 (dedup fix, repo description fix) |
| Themes | 6 (Midnight, Aurora, Sunset, Neon, Arctic, Mono) |
| Gallery developers | 9 |

## Features

| Issue | Feature |
|-------|---------|
| [#63](https://github.com/samuelkahessay/agentic-pipeline/issues/63) | Project Scaffold — Next.js 14 + TypeScript + Tailwind + Vitest |
| [#64](https://github.com/samuelkahessay/agentic-pipeline/issues/64) | GitHub Data Layer — Types, Fixtures, and API Fetching |
| [#65](https://github.com/samuelkahessay/agentic-pipeline/issues/65) | Navigation Bar and Landing Page with Username Form |
| [#66](https://github.com/samuelkahessay/agentic-pipeline/issues/66) | Card Component — Profile Section (Avatar, Bio, Stats) |
| [#67](https://github.com/samuelkahessay/agentic-pipeline/issues/67) | Card Component — Language Breakdown Bar and Color Map |
| [#68](https://github.com/samuelkahessay/agentic-pipeline/issues/68) | Card Component — Top Repositories List |
| [#69](https://github.com/samuelkahessay/agentic-pipeline/issues/69) | Card Themes — Theme Data, DevCard Theming, and Theme Selector |
| [#70](https://github.com/samuelkahessay/agentic-pipeline/issues/70) | Card Generator Page — /card/[username] Dynamic Route |
| [#71](https://github.com/samuelkahessay/agentic-pipeline/issues/71) | Card Export — Download PNG and Copy Link Buttons |
| [#73](https://github.com/samuelkahessay/agentic-pipeline/issues/73) | Gallery Page — Grid of Notable Developer DevCards |

## Bug Fixes (post-run)

| Issue | Fix |
|-------|-----|
| [#89](https://github.com/samuelkahessay/agentic-pipeline/issues/89) | Wire LanguageBar and TopRepos into DevCard (empty placeholders) |
| [#90](https://github.com/samuelkahessay/agentic-pipeline/issues/90) | Fix sarah-edo 404 — username changed |
| [#91](https://github.com/samuelkahessay/agentic-pipeline/issues/91) | Add OpenClaw creator steipete to gallery |
| [#101](https://github.com/samuelkahessay/agentic-pipeline/issues/101) | Fix gallery card clipping at 0.75 scale |
| [#102](https://github.com/samuelkahessay/agentic-pipeline/issues/102) | Add box-shadow for card visual separation |
| [#103](https://github.com/samuelkahessay/agentic-pipeline/issues/103) | Fix sdrasner → sdras username |
| [#104](https://github.com/samuelkahessay/agentic-pipeline/issues/104) | Fix share URL hydration mismatch |

## Pipeline Lessons

- **Integration gaps**: Each card section was built as a separate PR, but the final wiring step left empty placeholders — LanguageBar and TopRepos components existed but were never rendered
- **Duplicate PRs from concurrent runs**: Multiple workflow_dispatch runs processed the same issues simultaneously, creating duplicate PRs that merged and collided (duplicate useState declarations)
- **LLM username guessing**: Agent changed sarah-edo to sdrasner (wrong) instead of verifying via the GitHub API — acceptance criteria should require API verification
- **Auto-dispatch workflow**: Added `.github/workflows/auto-dispatch.yml` to bridge the gap between issue creation and repo-assist activation (workflow_dispatch with debounce)

## Restore Code

```bash
git checkout v3.0.0 -- src/ package.json tsconfig.json tailwind.config.ts postcss.config.js next.config.js vitest.config.ts
npm install
npm run dev
```
