#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

# shellcheck source=scripts/run-lifecycle-lib.sh
source "$ROOT_DIR/scripts/run-lifecycle-lib.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p \
  "$TMPDIR/web/app" \
  "$TMPDIR/src" \
  "$TMPDIR/PRDtoProd" \
  "$TMPDIR/PRDtoProd.Tests" \
  "$TMPDIR/drills/reports"
touch \
  "$TMPDIR/web/package.json" \
  "$TMPDIR/package.json" \
  "$TMPDIR/PRDtoProd.sln" \
  "$TMPDIR/Dockerfile" \
  "$TMPDIR/global.json" \
  "$TMPDIR/drills/reports/.gitkeep" \
  "$TMPDIR/drills/reports/run-05.json"

APP_PATHS=$(run_lifecycle_existing_app_paths "$TMPDIR")
printf '%s\n' "$APP_PATHS" | grep -Fx "web" >/dev/null
printf '%s\n' "$APP_PATHS" | grep -Fx "src" >/dev/null
printf '%s\n' "$APP_PATHS" | grep -Fx "PRDtoProd" >/dev/null
printf '%s\n' "$APP_PATHS" | grep -Fx "PRDtoProd.Tests" >/dev/null
printf '%s\n' "$APP_PATHS" | grep -Fx "package.json" >/dev/null
printf '%s\n' "$APP_PATHS" | grep -Fx "PRDtoProd.sln" >/dev/null
printf '%s\n' "$APP_PATHS" | grep -Fx "Dockerfile" >/dev/null
printf '%s\n' "$APP_PATHS" | grep -Fx "global.json" >/dev/null

run_lifecycle_has_active_app "$TMPDIR"

REPORT_PATHS=$(run_lifecycle_existing_report_paths "$TMPDIR")
printf '%s\n' "$REPORT_PATHS" | grep -Fx "drills/reports/run-05.json" >/dev/null

REMOVED_PATHS=$(run_lifecycle_remove_ephemeral_paths "$TMPDIR")
printf '%s\n' "$REMOVED_PATHS" | grep -Fx "web" >/dev/null
printf '%s\n' "$REMOVED_PATHS" | grep -Fx "PRDtoProd" >/dev/null
printf '%s\n' "$REMOVED_PATHS" | grep -Fx "PRDtoProd.sln" >/dev/null
printf '%s\n' "$REMOVED_PATHS" | grep -Fx "drills/reports/run-05.json" >/dev/null

[ ! -e "$TMPDIR/web" ]
[ ! -e "$TMPDIR/src" ]
[ ! -e "$TMPDIR/PRDtoProd" ]
[ ! -e "$TMPDIR/PRDtoProd.Tests" ]
[ ! -e "$TMPDIR/package.json" ]
[ ! -e "$TMPDIR/PRDtoProd.sln" ]
[ ! -e "$TMPDIR/Dockerfile" ]
[ ! -e "$TMPDIR/global.json" ]
[ ! -e "$TMPDIR/drills/reports/run-05.json" ]
[ -e "$TMPDIR/drills/reports/.gitkeep" ]

echo "run-lifecycle-lib.sh tests passed"
