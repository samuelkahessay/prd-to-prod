#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

for path in \
  console/server.js \
  console/package.json \
  console/lib/db.js \
  console/lib/orchestrator.js \
  console/lib/event-store.js \
  console/lib/run-mode.js \
  console/lib/preflight.js \
  console/routes/api-preflight.js \
  console/routes/api-run.js \
  console/routes/api-run-stream.js \
  console/routes/api-runs.js \
  console/routes/api-queue.js \
  console/routes/api-run-decisions.js \
  console/routes/api-run-audit.js \
  console/data/.gitkeep; do
  [ -e "$ROOT_DIR/$path" ] || {
    echo "FAIL: missing console path $path" >&2
    exit 1
  }
done

for removed_path in \
  console/routes/api-history.js \
  console/public; do
  [ ! -e "$ROOT_DIR/$removed_path" ] || {
    echo "FAIL: stale console path still present: $removed_path" >&2
    exit 1
  }
done

grep -F 'console/' "$ROOT_DIR/scaffold/template-manifest.yml" >/dev/null || {
  echo "FAIL: console/ must be explicitly forbidden from scaffold export" >&2
  exit 1
}

echo "console structure tests passed"
