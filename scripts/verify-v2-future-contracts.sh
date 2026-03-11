#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FUTURE_CHECKS=(
  "bash scripts/tests/test-analyze-target.sh"
  "bash scripts/tests/test-analyze-target-degraded.sh"
  "bash scripts/tests/test-validate-deployment.sh"
  "bash scripts/tests/test-classify-ci-failure.sh"
)

FAILED_CHECKS=()

for check_cmd in "${FUTURE_CHECKS[@]}"; do
  echo "==> ${check_cmd}"
  if ! (cd "$REPO_ROOT" && eval "$check_cmd"); then
    FAILED_CHECKS+=("$check_cmd")
  fi
done

if [ "${#FAILED_CHECKS[@]}" -gt 0 ]; then
  echo "FAIL (${#FAILED_CHECKS[@]} future contract checks failed)"
  for failed in "${FAILED_CHECKS[@]}"; do
    echo " - ${failed}"
  done
  exit 1
fi

echo "PASS (future v2 contracts)"
