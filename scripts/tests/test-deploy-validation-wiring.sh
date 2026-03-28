#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
DEPLOY_ROUTER="$ROOT_DIR/.github/workflows/deploy-router.yml"
DEPLOY_WORKFLOW="$ROOT_DIR/.github/workflows/deploy-vercel.yml"
VALIDATE_WORKFLOW="$ROOT_DIR/.github/workflows/validate-deployment.yml"
CLOSE_ISSUES="$ROOT_DIR/.github/workflows/close-issues.yml"
DEPLOY_PROFILE="$ROOT_DIR/.github/deploy-profiles/nextjs-vercel.yml"

grep -F 'uses: ./.github/workflows/validate-deployment.yml' "$DEPLOY_ROUTER" >/dev/null || {
  echo "FAIL: deploy-router.yml must call validate-deployment.yml" >&2
  exit 1
}

grep -F 'issue_numbers: ${{ steps.read.outputs.issue_numbers }}' "$DEPLOY_ROUTER" >/dev/null || {
  echo "FAIL: deploy-router.yml must surface linked issue numbers" >&2
  exit 1
}

grep -F 'Skipping deploy-vercel because these beta deploy credentials are missing' "$DEPLOY_WORKFLOW" >/dev/null || {
  echo "FAIL: deploy-vercel.yml must skip cleanly when Vercel credentials are absent" >&2
  exit 1
}

grep -F 'bash scripts/resolve-nextjs-app-root.sh' "$DEPLOY_WORKFLOW" >/dev/null || {
  echo "FAIL: deploy-vercel.yml must resolve the Next.js app root before building" >&2
  exit 1
}

grep -F 'APP_ROOT="${{ steps.app-root.outputs.path }}"' "$DEPLOY_WORKFLOW" >/dev/null || {
  echo "FAIL: deploy-vercel.yml must validate the resolved Next.js app root before invoking Vercel" >&2
  exit 1
}

grep -F 'web/package.json' "$DEPLOY_PROFILE" >/dev/null || {
  echo "FAIL: nextjs-vercel profile must detect the scaffolded web/package.json" >&2
  exit 1
}

grep -F 'APP_ROOT=$(bash scripts/resolve-nextjs-app-root.sh)' "$DEPLOY_PROFILE" >/dev/null || {
  echo "FAIL: nextjs-vercel profile must use the shared app-root resolver" >&2
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

grep -F 'This beta run remains in repo handoff mode.' "$VALIDATE_WORKFLOW" >/dev/null || {
  echo "FAIL: validate-deployment.yml must record the intentional no-deploy beta path" >&2
  exit 1
}

grep -F 'Issue closure deferred pending post-deploy validation.' "$CLOSE_ISSUES" >/dev/null || {
  echo "FAIL: close-issues.yml must defer closure while validation is pending" >&2
  exit 1
}

echo "deploy-validation wiring tests passed"
