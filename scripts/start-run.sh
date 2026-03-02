#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# start-run.sh — Prepare the pipeline for a new PRD run
#
# Usage:
#   bash scripts/start-run.sh <path-to-prd>
#
# Example:
#   bash scripts/start-run.sh ~/my-project/requirements.md
#
# What it does:
#   1. Detects whether this is a clean-slate or enhancement run
#   2. Copies the PRD into docs/prd/
#   3. Creates a GitHub Issue with the PRD content
#   4. Prints next steps (run /decompose)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

PRD_PATH="${1:?Usage: start-run.sh <path-to-prd-file>}"
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(pwd)

# shellcheck source=scripts/run-lifecycle-lib.sh
source "${SCRIPT_DIR}/run-lifecycle-lib.sh"

if [ ! -f "${PRD_PATH}" ]; then
  echo "ERROR: PRD file not found: ${PRD_PATH}"
  exit 1
fi

PRD_FILENAME=$(basename "${PRD_PATH}")

echo "════════════════════════════════════════════"
echo "  Start New Pipeline Run"
echo "  PRD: ${PRD_FILENAME}"
echo "  Repo: ${REPO}"
echo "════════════════════════════════════════════"
echo ""

# ── Preflight: detect active application code ──
if run_lifecycle_has_active_app "${REPO_ROOT}"; then
  echo "⚠ NOTICE: active application artifacts detected in the repo:"
  while IFS= read -r path; do
    echo "  - ${path}"
  done < <(run_lifecycle_existing_app_paths "${REPO_ROOT}")
  echo ""
  echo "  Enhancement runs are supported. Continue if this PRD extends the current app."
  echo "  If you want a clean-slate run, archive the current run first."
  echo ""
fi

# ── Step 1: Copy PRD into docs/prd/ ──
echo "▸ Copying PRD to docs/prd/${PRD_FILENAME}..."
mkdir -p docs/prd
cp "${PRD_PATH}" "docs/prd/${PRD_FILENAME}"
echo "  ✓ PRD copied"
echo ""

# ── Step 2: Commit the PRD ──
echo "▸ Committing PRD..."
git add "docs/prd/${PRD_FILENAME}"
git commit -m "docs: add PRD — ${PRD_FILENAME}"
echo "  ✓ Committed"
echo ""

# ── Step 3: Push ──
echo "▸ Pushing to origin..."
echo "  ⚠ Run 'git push origin main' manually if credential manager prompts."
echo ""

# ── Step 4: Create the PRD issue ──
echo "▸ Creating PRD issue on GitHub..."
PRD_TITLE=$(head -5 "docs/prd/${PRD_FILENAME}" | grep -m1 '^#' | sed 's/^#\+ *//' || echo "${PRD_FILENAME}")
ISSUE_URL=$(gh issue create --repo "${REPO}" \
  --title "PRD: ${PRD_TITLE}" \
  --body-file "docs/prd/${PRD_FILENAME}" \
  --label "pipeline")
echo "  ✓ Created: ${ISSUE_URL}"
echo ""

ISSUE_NUM=$(echo "${ISSUE_URL}" | grep -o '[0-9]*$')

echo "════════════════════════════════════════════"
echo "  ✓ PRD staged and issue created!"
echo ""
echo "  Next steps:"
echo "    1. git push origin main"
echo "    2. Comment on issue #${ISSUE_NUM}:  /decompose"
echo "    3. Monitor: bash scripts/monitor-pipeline.sh"
echo ""
echo "  The pipeline will:"
echo "    - Decompose the PRD into atomic issues"
echo "    - Implement each issue as a PR"
echo "    - Review, approve, and merge autonomously"
echo "════════════════════════════════════════════"
