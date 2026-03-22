#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/e2e/provision-smoke.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

RUNTIME_ENV_SCRIPT="$TMPDIR/runtime-env.sh"
HARNESS_SCRIPT="$TMPDIR/harness.sh"
ENV_FILE="$TMPDIR/runtime-env"
COOKIE_JAR="$TMPDIR/.e2e-cookiejar"
CALLS_FILE="$TMPDIR/calls.log"

cat > "$RUNTIME_ENV_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "runtime-env $*" >> "$CALLS_FILE"
cat > "$3" <<ENV
export E2E_COPILOT_GITHUB_TOKEN='github_pat_test'
export PIPELINE_APP_ID='12345'
export PIPELINE_APP_PRIVATE_KEY='private-key'
export BUILD_INTERNAL_SECRET='internal-secret'
export E2E_CONSOLE_URL='https://console.example.com'
export E2E_STUDIO_URL='https://studio.example.com'
ENV
EOF

cat > "$HARNESS_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "harness $*" >> "$CALLS_FILE"
EOF

chmod +x "$RUNTIME_ENV_SCRIPT" "$HARNESS_SCRIPT"
touch "$COOKIE_JAR"
export CALLS_FILE

E2E_RUNTIME_ENV_SCRIPT="$RUNTIME_ENV_SCRIPT" \
E2E_HARNESS_SCRIPT="$HARNESS_SCRIPT" \
E2E_RUNTIME_ENV_FILE="$ENV_FILE" \
E2E_COOKIE_JAR_PATH="$COOKIE_JAR" \
bash "$SCRIPT" >/dev/null

if ! grep -qF "runtime-env refresh --path $ENV_FILE" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to refresh the runtime env when missing" >&2
  exit 1
fi

if ! grep -qF "harness auth-check --path $COOKIE_JAR" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to validate auth first" >&2
  exit 1
fi

if ! grep -qF "harness run --lane provision-only --path $COOKIE_JAR" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to run provision-only" >&2
  exit 1
fi

: > "$CALLS_FILE"
E2E_RUNTIME_ENV_SCRIPT="$RUNTIME_ENV_SCRIPT" \
E2E_HARNESS_SCRIPT="$HARNESS_SCRIPT" \
E2E_RUNTIME_ENV_FILE="$ENV_FILE" \
E2E_COOKIE_JAR_PATH="$COOKIE_JAR" \
bash "$SCRIPT" --keep-repo >/dev/null

if grep -qF "runtime-env refresh" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to reuse the cached env file" >&2
  exit 1
fi

if ! grep -qF "harness run --lane provision-only --path $COOKIE_JAR --keep-repo" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to forward --keep-repo" >&2
  exit 1
fi

echo "provision-smoke.sh tests passed"
