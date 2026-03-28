#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/resolve-nextjs-app-root.sh"

APP_ROOT=$(bash "$SCRIPT" "$ROOT_DIR")
[ "$APP_ROOT" = "web" ] || {
  echo "FAIL: expected repo app root to resolve to web, got '$APP_ROOT'" >&2
  exit 1
}

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat > "$TMPDIR/package.json" <<'JSON'
{
  "name": "root-app"
}
JSON
cat > "$TMPDIR/next.config.ts" <<'TS'
export default {};
TS

APP_ROOT=$(bash "$SCRIPT" "$TMPDIR")
[ "$APP_ROOT" = "." ] || {
  echo "FAIL: expected root-only app to resolve to '.', got '$APP_ROOT'" >&2
  exit 1
}

if bash "$SCRIPT" "$TMPDIR/missing" >/dev/null 2>&1; then
  echo "FAIL: expected missing app root to fail resolution" >&2
  exit 1
fi

echo "resolve-nextjs-app-root tests passed"
