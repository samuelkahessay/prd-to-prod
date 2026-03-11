#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
ERRORS=0

run_check() {
  local name="$1" cmd="$2"
  if (cd "$ROOT_DIR" && eval "$cmd" >/dev/null 2>&1); then
    echo "PASS: $name"
  else
    echo "FAIL: $name"
    ((ERRORS++))
  fi
}

echo "=== Final Validation Matrix ==="

# Scaffold pipeline
run_check "export-scaffold" "bash scaffold/export-scaffold.sh"
run_check "leak-test" "bash scaffold/leak-test.sh"
run_check "bootstrap-test" "bash scaffold/bootstrap-test.sh"

# Extraction contracts
run_check "validate-prd" "bash scripts/tests/test-validate-prd.sh"
run_check "classify-transcript" "bash scripts/tests/test-classify-transcript.sh"
run_check "extraction-run" "bash scripts/tests/test-extraction-run.sh"
run_check "push-to-existing" "bash scripts/tests/test-push-to-existing.sh"
run_check "push-to-existing-golden" "bash scripts/tests/test-push-to-existing-golden.sh"
run_check "ci-failure-router-v2" "bash scripts/tests/test-ci-failure-router-v2.sh"
run_check "resolve-deployment-url" "bash scripts/tests/test-resolve-deployment-url.sh"
run_check "deploy-validation-wiring" "bash scripts/tests/test-deploy-validation-wiring.sh"
run_check "retry-state" "bash scripts/tests/test-retry-state.sh"

# Greenfield mock smoke
run_check "extract-prd-mock" "bash scripts/tests/test-extract-prd-mock.sh"
run_check "push-to-pipeline-dryrun" "bash scripts/tests/test-push-to-pipeline-dryrun.sh"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS check(s) failed in validation matrix"
  exit 1
fi

echo "=== Final validation matrix PASSED ==="
