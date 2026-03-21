#!/usr/bin/env bash
set -euo pipefail

# patch-runner-labels.sh — Replaces gh-aw's internal runner labels with
# standard GitHub-hosted runners.
#
# gh-aw compile injects "ubuntu-slim" which only works on GitHub's own
# infrastructure. Customer repos need "ubuntu-latest".
#
# Usage: bash scripts/patch-runner-labels.sh [workflow-dir]

WORKFLOW_DIR="${1:-.github/workflows}"

COUNT=0
for f in "$WORKFLOW_DIR"/*.lock.yml "$WORKFLOW_DIR"/*.yml; do
  [ -f "$f" ] || continue
  if grep -q "ubuntu-slim" "$f"; then
    sed -i '' 's/ubuntu-slim/ubuntu-latest/g' "$f" 2>/dev/null || \
      sed -i 's/ubuntu-slim/ubuntu-latest/g' "$f"
    COUNT=$((COUNT + 1))
  fi
done

echo "Patched $COUNT lock file(s) in $WORKFLOW_DIR"
