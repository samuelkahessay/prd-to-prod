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
export E2E_OPENAI_API_KEY='sk-or-v1-test'
export PIPELINE_APP_ID='12345'
export PIPELINE_APP_PRIVATE_KEY='private-key'
export BUILD_INTERNAL_SECRET='internal-secret'
export E2E_CONSOLE_URL='https://console.example.com'
export E2E_WEB_URL='https://web.example.com'
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
E2E_PROVISION_SMOKE_DISABLE_WORKTREE=1 \
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
E2E_PROVISION_SMOKE_DISABLE_WORKTREE=1 \
bash "$SCRIPT" --keep-repo >/dev/null

if grep -qF "runtime-env refresh" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to reuse the cached env file" >&2
  exit 1
fi

if ! grep -qF "harness run --lane provision-only --path $COOKIE_JAR --keep-repo" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to forward --keep-repo" >&2
  exit 1
fi

WORKTREE_GIT="$TMPDIR/git"
DEPENDENCY_SOURCE_ROOT="$TMPDIR/dependency-source"
STATE_ROOT="$TMPDIR/state-root"
: > "$CALLS_FILE"

mkdir -p \
  "$DEPENDENCY_SOURCE_ROOT/console/node_modules/better-sqlite3" \
  "$DEPENDENCY_SOURCE_ROOT/web/node_modules/next"
touch \
  "$DEPENDENCY_SOURCE_ROOT/console/node_modules/better-sqlite3/package.json" \
  "$DEPENDENCY_SOURCE_ROOT/web/node_modules/next/package.json"

cat > "$WORKTREE_GIT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "-C" ]]; then
  shift 2
fi

case "$1" in
  status)
    printf ' M dirty-file\n'
    ;;
  worktree)
    case "$2" in
      add)
        worktree_dir="$4"
        echo "git worktree add $worktree_dir" >> "$CALLS_FILE"
        mkdir -p "$worktree_dir/scripts/e2e" "$worktree_dir/console" "$worktree_dir/web"
        cat > "$worktree_dir/scripts/e2e/provision-smoke.sh" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
child_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
console_copy=0
web_copy=0
if [[ -d "$child_root/console/node_modules" && ! -L "$child_root/console/node_modules" ]]; then
  console_copy=1
fi
if [[ -d "$child_root/web/node_modules" && ! -L "$child_root/web/node_modules" ]]; then
  web_copy=1
fi
mkdir -p "$child_root/output/e2e/run-123" "$child_root/docs/internal/e2e-runs"
printf '{}\n' > "$child_root/output/e2e/run-123/report.json"
printf '# report\n' > "$child_root/docs/internal/e2e-runs/report.md"
echo "child worktree run state-root=$E2E_STATE_ROOT env-file=$E2E_RUNTIME_ENV_FILE cookie=$E2E_COOKIE_JAR_PATH child=$E2E_PROVISION_SMOKE_CHILD console-copy=$console_copy web-copy=$web_copy" >> "$CALLS_FILE"
EOS
        chmod +x "$worktree_dir/scripts/e2e/provision-smoke.sh"
        ;;
      remove)
        echo "git worktree remove $4" >> "$CALLS_FILE"
        ;;
      *)
        echo "Unexpected git worktree command: $*" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "Unexpected git command: $*" >&2
    exit 1
    ;;
esac
EOF

chmod +x "$WORKTREE_GIT"

PATH="$TMPDIR:$PATH" \
CALLS_FILE="$CALLS_FILE" \
E2E_RUNTIME_ENV_FILE="$ENV_FILE" \
E2E_COOKIE_JAR_PATH="$COOKIE_JAR" \
E2E_PROVISION_SMOKE_DEPENDENCY_SOURCE_ROOT="$DEPENDENCY_SOURCE_ROOT" \
E2E_STATE_ROOT="$STATE_ROOT" \
bash "$SCRIPT" >/dev/null

if ! grep -qF "git worktree add" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to create a clean worktree when the source checkout is dirty" >&2
  exit 1
fi

if ! grep -qF "child worktree run state-root=" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to re-run itself from the clean worktree" >&2
  exit 1
fi

if ! grep -qF "child=1" "$CALLS_FILE"; then
  echo "FAIL: expected child worktree execution to be marked as a child run" >&2
  exit 1
fi

if ! grep -qF "console-copy=1" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to copy console/node_modules into the clean worktree" >&2
  exit 1
fi

if ! grep -qF "web-copy=1" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to copy web/node_modules into the clean worktree" >&2
  exit 1
fi

if ! grep -qF "git worktree remove" "$CALLS_FILE"; then
  echo "FAIL: expected provision-smoke to remove the temporary worktree" >&2
  exit 1
fi

if [[ ! -f "$STATE_ROOT/output/e2e/run-123/report.json" ]]; then
  echo "FAIL: expected provision-smoke to copy JSON reports back to the state root before cleanup" >&2
  exit 1
fi

if [[ ! -f "$STATE_ROOT/docs/internal/e2e-runs/report.md" ]]; then
  echo "FAIL: expected provision-smoke to copy markdown reports back to the state root before cleanup" >&2
  exit 1
fi

echo "provision-smoke.sh tests passed"
