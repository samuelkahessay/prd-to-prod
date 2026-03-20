#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/publish-scaffold-template.yml"

if [ ! -f "$WORKFLOW" ]; then
  echo "RED: $WORKFLOW does not exist yet — test defines the contract" >&2
  exit 1
fi

grep -q "workflow_dispatch:" "$WORKFLOW" || {
  echo "FAIL: Test 1: workflow_dispatch trigger missing" >&2
  exit 1
}
grep -q "source_ref:" "$WORKFLOW" || {
  echo "FAIL: Test 1: source_ref input missing" >&2
  exit 1
}
grep -q "default: main" "$WORKFLOW" || {
  echo "FAIL: Test 1: source_ref should default to main" >&2
  exit 1
}
echo "Test 1 passed: manual publish interface present"

grep -q "branches: \\[main\\]" "$WORKFLOW" || {
  echo "FAIL: Test 2: workflow should publish from main pushes" >&2
  exit 1
}
grep -q "bash scaffold/export-scaffold.sh" "$WORKFLOW" || {
  echo "FAIL: Test 2: scaffold export gate missing" >&2
  exit 1
}
grep -q "bash scaffold/leak-test.sh" "$WORKFLOW" || {
  echo "FAIL: Test 2: leak-test gate missing" >&2
  exit 1
}
grep -q "bash scaffold/bootstrap-test.sh" "$WORKFLOW" || {
  echo "FAIL: Test 2: bootstrap-test gate missing" >&2
  exit 1
}
echo "Test 2 passed: publish gates present"

grep -q "vars.PUBLIC_BETA_TEMPLATE_OWNER" "$WORKFLOW" || {
  echo "FAIL: Test 3: template owner var missing" >&2
  exit 1
}
grep -q "vars.PUBLIC_BETA_TEMPLATE_REPO" "$WORKFLOW" || {
  echo "FAIL: Test 3: template repo var missing" >&2
  exit 1
}
grep -q "GH_AW_GITHUB_TOKEN" "$WORKFLOW" || {
  echo "FAIL: Test 3: GH_AW_GITHUB_TOKEN secret missing" >&2
  exit 1
}
echo "Test 3 passed: publish auth is wired"

grep -q "bash scripts/publish-scaffold-template.sh dist/scaffold" "$WORKFLOW" || {
  echo "FAIL: Test 4: publish step should mirror dist/scaffold" >&2
  exit 1
}
if grep -q "bash scripts/publish-scaffold-template.sh \\." "$WORKFLOW"; then
  echo "FAIL: Test 4: publish step should not mirror the repo root" >&2
  exit 1
fi
echo "Test 4 passed: publish uses exported scaffold contents"

echo "publish-scaffold-template workflow tests passed"
