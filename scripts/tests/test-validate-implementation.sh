#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/validate-implementation.sh"

[ -x "$SCRIPT" ] || {
  echo "FAIL: validate-implementation.sh must exist and be executable" >&2
  exit 1
}

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/scripts" "$TMPDIR/.github/deploy-profiles" "$TMPDIR/web" "$TMPDIR/console" "$TMPDIR/bin"
cp "$ROOT_DIR/scripts/validate-implementation.sh" "$TMPDIR/scripts/"
cp "$ROOT_DIR/scripts/require-node.sh" "$TMPDIR/scripts/"
cp "$ROOT_DIR/scripts/resolve-nextjs-app-root.sh" "$TMPDIR/scripts/"
chmod +x "$TMPDIR/scripts/validate-implementation.sh" "$TMPDIR/scripts/resolve-nextjs-app-root.sh"

printf '22\n' > "$TMPDIR/.nvmrc"
printf 'nextjs-vercel\n' > "$TMPDIR/.deploy-profile"
cat > "$TMPDIR/.github/deploy-profiles/nextjs-vercel.yml" <<'YAML'
name: Next.js on Vercel
build:
  install: npm ci
  build: npm run build
  test: npm test
YAML
cat > "$TMPDIR/web/package.json" <<'JSON'
{"name":"web","private":true}
JSON
cat > "$TMPDIR/web/next.config.ts" <<'TS'
export default {};
TS
cat > "$TMPDIR/console/package.json" <<'JSON'
{"name":"console","private":true}
JSON

LOG_FILE="$TMPDIR/npm.log"
export LOG_FILE

cat > "$TMPDIR/bin/node" <<'STUB'
#!/usr/bin/env bash
if [ "${1:-}" = "-p" ]; then
  echo "22.0.0"
  exit 0
fi
echo "unexpected node args: $*" >&2
exit 1
STUB

cat > "$TMPDIR/bin/npm" <<'STUB'
#!/usr/bin/env bash
printf '%s|%s\n' "$PWD" "$*" >> "$LOG_FILE"
if [ "${VALIDATE_FAIL_MATCH:-}" = "$PWD|$*" ]; then
  exit 1
fi
exit 0
STUB

chmod +x "$TMPDIR/bin/node" "$TMPDIR/bin/npm"

(
  cd "$TMPDIR"
  PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null
)

grep -F "$TMPDIR/web|ci" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm ci in the app root" >&2
  exit 1
}

grep -F "$TMPDIR/web|run build" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm run build in the app root" >&2
  exit 1
}

grep -F "$TMPDIR/web|test" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm test in the app root" >&2
  exit 1
}

grep -F "$TMPDIR/console|ci" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm ci in console when present" >&2
  exit 1
}

grep -F "$TMPDIR/console|test" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm test in console when present" >&2
  exit 1
}

printf 'unsupported-profile\n' > "$TMPDIR/.deploy-profile"
if (
  cd "$TMPDIR"
  PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null 2>&1
); then
  echo "FAIL: validate-implementation.sh must fail for unsupported profiles" >&2
  exit 1
fi

printf 'nextjs-vercel\n' > "$TMPDIR/.deploy-profile"
rm -f "$TMPDIR/console/package.json"
: > "$LOG_FILE"
(
  cd "$TMPDIR"
  PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null
)

if grep -F "$TMPDIR/console|" "$LOG_FILE" >/dev/null; then
  echo "FAIL: validate-implementation.sh must skip console commands when console/package.json is absent" >&2
  exit 1
fi

echo "validate-implementation tests passed"
