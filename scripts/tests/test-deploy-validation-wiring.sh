#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
DEPLOY_ROUTER="$ROOT_DIR/.github/workflows/deploy-router.yml"
VALIDATE_WORKFLOW="$ROOT_DIR/.github/workflows/validate-deployment.yml"
CLOSE_ISSUES="$ROOT_DIR/.github/workflows/close-issues.yml"

grep -F 'uses: ./.github/workflows/validate-deployment.yml' "$DEPLOY_ROUTER" >/dev/null || {
  echo "FAIL: deploy-router.yml must call validate-deployment.yml" >&2
  exit 1
}

grep -F 'issue_numbers: ${{ steps.read.outputs.issue_numbers }}' "$DEPLOY_ROUTER" >/dev/null || {
  echo "FAIL: deploy-router.yml must surface linked issue numbers" >&2
  exit 1
}

grep -F 'bash scripts/resolve-deployment-url.sh "$PROFILE"' "$VALIDATE_WORKFLOW" >/dev/null || {
  echo "FAIL: validate-deployment.yml must resolve a deployment URL" >&2
  exit 1
}

grep -F 'bash extraction/validate-deployment.sh > validation-result.json' "$VALIDATE_WORKFLOW" >/dev/null || {
  echo "FAIL: validate-deployment.yml must invoke extraction/validate-deployment.sh" >&2
  exit 1
}

grep -F 'Issue closure deferred pending post-deploy validation.' "$CLOSE_ISSUES" >/dev/null || {
  echo "FAIL: close-issues.yml must defer closure while validation is pending" >&2
  exit 1
}

echo "deploy-validation wiring tests passed"
