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
run_check "console-structure" "bash scripts/tests/test-console-structure.sh"
run_check "console-preflight" "bash scripts/tests/test-console-preflight.sh"
run_check "console-server" "bash scripts/tests/test-console-server.sh"
run_check "node-runtime-contract" "bash scripts/tests/test-node-runtime-contract.sh"
run_check "pre-e2e-gate" "bash scripts/tests/test-pre-e2e-gate.sh"
run_check "e2e-runtime-env" "bash scripts/tests/test-e2e-runtime-env.sh"
run_check "disable-test-repo-workflows" "bash scripts/tests/test-disable-test-repo-workflows.sh"
if [ "${SKIP_E2E_PROVISION_SMOKE_TEST:-0}" = "1" ]; then
  echo "SKIP: e2e-provision-smoke"
else
  run_check "e2e-provision-smoke" "bash scripts/tests/test-e2e-provision-smoke.sh"
fi
run_check "export-scaffold" "bash scripts/tests/test-export-scaffold.sh"
run_check "leak-test" "bash scripts/tests/test-leak-test.sh"
run_check "bootstrap-test" "bash scripts/tests/test-bootstrap-test.sh"
run_check "publish-scaffold-template" "bash scripts/tests/test-publish-scaffold-template.sh"
run_check "publish-scaffold-template-workflow" "bash scripts/tests/test-publish-scaffold-template-workflow.sh"
run_check "agent-memory-bounds" "bash scripts/tests/test-agent-memory-bounds.sh"
run_check "repo-assist-no-project-status" "bash scripts/tests/test-repo-assist-no-project-status.sh"

# Extraction contracts
run_check "validate-prd" "bash scripts/tests/test-validate-prd.sh"
run_check "classify-transcript" "bash scripts/tests/test-classify-transcript.sh"
run_check "extraction-run" "bash scripts/tests/test-extraction-run.sh"
run_check "push-to-existing" "bash scripts/tests/test-push-to-existing.sh"
run_check "push-to-existing-golden" "bash scripts/tests/test-push-to-existing-golden.sh"
run_check "ci-failure-router-v2" "bash scripts/tests/test-ci-failure-router-v2.sh"
run_check "auto-dispatch" "bash scripts/tests/test-auto-dispatch.sh"
run_check "auto-dispatch-requeue" "bash scripts/tests/test-auto-dispatch-requeue.sh"
run_check "resolve-deployment-url" "bash scripts/tests/test-resolve-deployment-url.sh"
run_check "deploy-validation-wiring" "bash scripts/tests/test-deploy-validation-wiring.sh"
run_check "retry-state" "bash scripts/tests/test-retry-state.sh"
run_check "self-healing-dispatch-substate" "bash scripts/tests/test-self-healing-drill-dispatch-substate.sh"
run_check "self-healing-workflow-matching" "bash scripts/tests/test-self-healing-drill-workflow-matching.sh"
run_check "pipeline-watchdog" "bash scripts/tests/test-pipeline-watchdog.sh"
run_check "patch-codex-openrouter-http-locks" "bash scripts/tests/test-patch-codex-openrouter-http-locks.sh"

# Greenfield mock smoke
run_check "extract-prd-mock" "bash scripts/tests/test-extract-prd-mock.sh"
run_check "push-to-pipeline-dryrun" "bash scripts/tests/test-push-to-pipeline-dryrun.sh"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS check(s) failed in validation matrix"
  exit 1
fi

echo "=== Final validation matrix PASSED ==="
