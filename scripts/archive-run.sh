#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# archive-run.sh — Tag, showcase, and reset the repo after a PRD run
#
# Usage:
#   bash scripts/archive-run.sh <run-number> <slug> <tag> [deployment-url]
#
# Example:
#   bash scripts/archive-run.sh 02 pipeline-observatory v2.0.0 https://prdtoprod.vercel.app
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Args ──
RUN_NUM="${1:?Usage: archive-run.sh <run-number> <slug> <tag> [deployment-url]}"
SLUG="${2:?Usage: archive-run.sh <run-number> <slug> <tag> [deployment-url]}"
TAG="${3:?Usage: archive-run.sh <run-number> <slug> <tag> [deployment-url]}"
DEPLOY_URL="${4:-}"
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')

echo "════════════════════════════════════════════"
echo "  Archive Run ${RUN_NUM}: ${SLUG}"
echo "  Tag: ${TAG}  Repo: ${REPO}"
echo "════════════════════════════════════════════"
echo ""

# ── Preflight ──
if git tag -l | grep -q "^${TAG}$"; then
  echo "ERROR: Tag ${TAG} already exists. Aborting."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is dirty. Commit or stash changes first."
  exit 1
fi

# ── Step 1: Tag the current state ──
echo "▸ Creating annotated tag ${TAG}..."
git tag -a "${TAG}" -m "Archive: Run ${RUN_NUM} — ${SLUG}"
git push origin "${TAG}"
echo "  ✓ Tag ${TAG} pushed"
echo ""

# ── Step 2: Generate showcase entry (if it doesn't exist) ──
SHOWCASE_DIR="showcase/${RUN_NUM}-${SLUG}"
if [ ! -f "${SHOWCASE_DIR}/README.md" ]; then
  echo "▸ Generating showcase entry at ${SHOWCASE_DIR}/..."
  mkdir -p "${SHOWCASE_DIR}"

  # Gather stats
  ISSUE_COUNT=$(gh issue list --repo "${REPO}" --label pipeline --state all --json number --jq 'length' 2>/dev/null || echo "?")
  PR_COUNT=$(gh pr list --repo "${REPO}" --label pipeline --state merged --json number --jq 'length' 2>/dev/null || echo "?")

  DEPLOY_LINE=""
  if [ -n "${DEPLOY_URL}" ]; then
    DEPLOY_LINE="**Deployment**: [${DEPLOY_URL}](${DEPLOY_URL})"
  fi

  cat > "${SHOWCASE_DIR}/README.md" <<EOF
# Run ${RUN_NUM} — ${SLUG}

**Tag**: [\`${TAG}\`](https://github.com/${REPO}/tree/${TAG})
${DEPLOY_LINE}
**Date**: $(date +"%B %Y")

## Stats

| Metric | Value |
|--------|-------|
| Pipeline issues | ${ISSUE_COUNT} |
| PRs merged | ${PR_COUNT} |

## Restore Code

\`\`\`bash
git checkout ${TAG} -- src/
\`\`\`

> Fill in additional details: summary, tech stack, lessons learned.
EOF
  echo "  ✓ Showcase entry created (edit ${SHOWCASE_DIR}/README.md to add details)"
else
  echo "▸ Showcase entry already exists at ${SHOWCASE_DIR}/README.md — skipping"
fi
echo ""

# ── Step 3: Bulk-close open pipeline issues ──
echo "▸ Closing open pipeline issues..."
OPEN_ISSUES=$(gh issue list --repo "${REPO}" --label pipeline --state open --json number --jq '.[].number' 2>/dev/null || echo "")
if [ -z "${OPEN_ISSUES}" ]; then
  echo "  No open pipeline issues found."
else
  for ISSUE in ${OPEN_ISSUES}; do
    gh issue close "${ISSUE}" --repo "${REPO}" \
      -c "Archived as part of Run ${RUN_NUM} (${SLUG}). Tag: ${TAG}" 2>/dev/null || \
      echo "  ⚠ Could not close issue #${ISSUE}"
    echo "  ✓ Closed #${ISSUE}"
  done
fi

# Also close non-pipeline open issues that reference this run
OTHER_ISSUES=$(gh issue list --repo "${REPO}" --state open --json number --jq '.[].number' 2>/dev/null || echo "")
if [ -n "${OTHER_ISSUES}" ]; then
  for ISSUE in ${OTHER_ISSUES}; do
    gh issue close "${ISSUE}" --repo "${REPO}" \
      -c "Archived as part of Run ${RUN_NUM} (${SLUG}). Tag: ${TAG}" 2>/dev/null || true
    echo "  ✓ Closed #${ISSUE}"
  done
fi
echo ""

# ── Step 4: Remove PRD-specific files ──
echo "▸ Removing PRD implementation files..."

# Implementation code
rm -rf src/

# Config files (PRD-specific)
PRD_CONFIGS=(
  package.json
  package-lock.json
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  next.config.js
  vitest.config.ts
  vercel.json
  next-env.d.ts
)
for f in "${PRD_CONFIGS[@]}"; do
  if [ -f "$f" ]; then
    git rm -f "$f" 2>/dev/null || rm -f "$f"
    echo "  ✓ Removed $f"
  fi
done

# Build artifacts (may already be gitignored)
rm -rf node_modules/ .next/ dist/ .vercel/

# PRD-run-specific docs (keep PRDs themselves as input records)
rm -rf docs/plans/
rm -f docs/pipeline-status-review.md

echo "  ✓ Implementation files removed"
echo ""

# ── Step 5: Reset AGENTS.md to pipeline-only defaults ──
echo "▸ Resetting AGENTS.md..."
cat > AGENTS.md <<'AGENTS_EOF'
# Agents Configuration

## Project Overview
This repository is managed by an agentic pipeline. Issues are created from PRDs
by the prd-decomposer workflow, and implemented by the repo-assist workflow.

## Coding Standards
- Write tests for all new functionality
- Follow existing naming conventions
- Keep functions small and single-purpose
- Add comments only for non-obvious logic
- Use TypeScript strict mode when the PRD specifies TypeScript

## Build & Test
Check the active PRD and package.json for build/test commands.
When no PRD is active, there is no application code to build.

## Tech Stack
Determined by the active PRD. The pipeline is tech-stack agnostic.

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

## PRD Lifecycle
This repo follows a drop → run → tag → showcase → reset cycle:

### Permanent files (pipeline infrastructure)
- `.github/` — Workflows, agent configs, copilot instructions
- `scripts/` — Bootstrap, archive, monitoring scripts
- `docs/prd/` — PRD input records (kept forever)
- `docs/ARCHITECTURE.md` — Pipeline architecture documentation
- `showcase/` — Completed run summaries with links to git tags
- `AGENTS.md` — This file (reset to defaults between runs)
- `README.md`, `LICENSE`, `.gitignore`

### Ephemeral files (removed on archive)
- `src/` — Application code (implementation of the active PRD)
- `package.json`, `tsconfig.json`, etc. — PRD-specific configs
- `docs/plans/` — Design documents for the active PRD
- `node_modules/`, `.next/`, `dist/` — Build artifacts
AGENTS_EOF
echo "  ✓ AGENTS.md reset"
echo ""

# ── Step 6: Stage, commit, push ──
echo "▸ Committing archive cleanup..."
git add -A
git commit -m "chore: archive Run ${RUN_NUM} (${SLUG}), reset for next PRD

Tag: ${TAG}
Showcase: showcase/${RUN_NUM}-${SLUG}/README.md
All pipeline issues closed. Implementation code removed."

echo ""
echo "▸ Pushing to origin..."
echo "  ⚠ Run 'git push origin main' manually (credential manager may prompt)."
echo ""

echo "════════════════════════════════════════════"
echo "  ✓ Archive complete!"
echo ""
echo "  Tag:      ${TAG}"
echo "  Showcase: showcase/${RUN_NUM}-${SLUG}/"
echo "  Restore:  git checkout ${TAG} -- src/"
echo ""
echo "  Next: drop a new PRD into docs/prd/ and /decompose"
echo "════════════════════════════════════════════"
