#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

[ -f "$ROOT_DIR/.nvmrc" ] || {
  echo "FAIL: .nvmrc is missing" >&2
  exit 1
}

[ -f "$ROOT_DIR/.node-version" ] || {
  echo "FAIL: .node-version is missing" >&2
  exit 1
}

[ "$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")" = "22" ] || {
  echo "FAIL: .nvmrc must pin Node 22" >&2
  exit 1
}

[ "$(tr -d '[:space:]' < "$ROOT_DIR/.node-version")" = "22" ] || {
  echo "FAIL: .node-version must pin Node 22" >&2
  exit 1
}

jq -e '.engines.node == "22.x"' "$ROOT_DIR/console/package.json" >/dev/null || {
  echo "FAIL: console/package.json must declare Node 22.x" >&2
  exit 1
}

jq -e '.engines.node == "22.x"' "$ROOT_DIR/web/package.json" >/dev/null || {
  echo "FAIL: web/package.json must declare Node 22.x" >&2
  exit 1
}

jq -e '.engines.node == "22.x"' "$ROOT_DIR/scaffold/web-shell/package.json" >/dev/null || {
  echo "FAIL: scaffold/web-shell/package.json must declare Node 22.x" >&2
  exit 1
}

[ "$(tr -d '[:space:]' < "$ROOT_DIR/console/.npmrc")" = "engine-strict=true" ] || {
  echo "FAIL: console/.npmrc must enable engine-strict" >&2
  exit 1
}

[ "$(tr -d '[:space:]' < "$ROOT_DIR/web/.npmrc")" = "engine-strict=true" ] || {
  echo "FAIL: web/.npmrc must enable engine-strict" >&2
  exit 1
}

[ "$(tr -d '[:space:]' < "$ROOT_DIR/scaffold/web-shell/.npmrc")" = "engine-strict=true" ] || {
  echo "FAIL: scaffold/web-shell/.npmrc must enable engine-strict" >&2
  exit 1
}

grep -F -- '- .nvmrc' "$ROOT_DIR/scaffold/template-manifest.yml" >/dev/null || {
  echo "FAIL: scaffold/template-manifest.yml must export .nvmrc" >&2
  exit 1
}

grep -F -- '- .node-version' "$ROOT_DIR/scaffold/template-manifest.yml" >/dev/null || {
  echo "FAIL: scaffold/template-manifest.yml must export .node-version" >&2
  exit 1
}

grep -F -- '- scripts/require-node.sh' "$ROOT_DIR/scaffold/template-manifest.yml" >/dev/null || {
  echo "FAIL: scaffold/template-manifest.yml must export scripts/require-node.sh" >&2
  exit 1
}

grep -F 'source "$ROOT/scripts/require-node.sh"' "$ROOT_DIR/scripts/e2e/harness.sh" >/dev/null || {
  echo "FAIL: e2e harness must source the shared Node runtime guard" >&2
  exit 1
}

grep -F 'source "$REPO_ROOT/scripts/require-node.sh"' "$ROOT_DIR/scripts/pre-e2e-gate.sh" >/dev/null || {
  echo "FAIL: pre-e2e-gate must source the shared Node runtime guard" >&2
  exit 1
}

grep -F 'source "$ROOT_DIR/scripts/require-node.sh"' "$ROOT_DIR/scripts/e2e/provision-smoke.sh" >/dev/null || {
  echo "FAIL: provision-smoke must source the shared Node runtime guard" >&2
  exit 1
}

grep -F 'source "$OUTPUT_DIR/scripts/require-node.sh"' "$ROOT_DIR/scaffold/bootstrap-test.sh" >/dev/null || {
  echo "FAIL: scaffold/bootstrap-test.sh must source the shared Node runtime guard" >&2
  exit 1
}

bash -lc "cd \"$ROOT_DIR\" && source scripts/require-node.sh && node -p 'process.versions.node' >/dev/null" || {
  echo "FAIL: require-node.sh must succeed from the repository root" >&2
  exit 1
}

echo "node runtime contract tests passed"
