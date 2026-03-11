#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

V2_CHECKS=(
  # Phase 1
  "bash scripts/tests/test-validate-prd.sh"
  "bash scripts/tests/test-manifest-completeness.sh"
  # Phase 2
  "bash scripts/tests/test-manifest-parse.sh"
  "bash scripts/tests/test-export-scaffold.sh"
  "bash scripts/tests/test-leak-test.sh"
  "bash scripts/tests/test-bootstrap-test.sh"
  # Phase 3
  "bash scripts/tests/test-extract-prd-mock.sh"
  "bash scripts/tests/test-push-to-pipeline-dryrun.sh"
  # Phase 4
  "bash scripts/tests/test-validate-schema.sh"
  "bash scripts/tests/test-classify-transcript.sh"
  "bash scripts/tests/test-extraction-run.sh"
  "bash scripts/tests/test-push-to-existing.sh"
  # Phase 5
  "bash scripts/tests/test-no-stale-references.sh"
  # Phase 6
  "bash scripts/tests/test-final-validation-matrix.sh"
)

run_check() {
  local check_cmd="$1"

  echo "==> ${check_cmd}"
  if ! (cd "$REPO_ROOT" && eval "$check_cmd"); then
    FAILED_CHECKS+=("$check_cmd")
  fi
}

FAILED_CHECKS=()

for check_cmd in "${V2_CHECKS[@]}"; do
  run_check "$check_cmd"
done

if [ "${#FAILED_CHECKS[@]}" -gt 0 ]; then
  echo "FAIL (${#FAILED_CHECKS[@]} failed checks)"
  for failed in "${FAILED_CHECKS[@]}"; do
    echo " - ${failed}"
  done
  exit 1
fi

echo "PASS (v2 contracts)"
