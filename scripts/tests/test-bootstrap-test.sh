#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
BOOTSTRAP_SCRIPT="$ROOT_DIR/scaffold/bootstrap-test.sh"
EXPORT_SCRIPT="$ROOT_DIR/scaffold/export-scaffold.sh"
OUTPUT_DIR="$ROOT_DIR/dist/scaffold"

if [ ! -x "$BOOTSTRAP_SCRIPT" ]; then
  echo "RED: $BOOTSTRAP_SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/bin"
cat > "$TMPDIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  aw)
    case "$2" in
      --help) exit 0 ;;
      compile)
        for source in .github/workflows/*.md; do
          [ -f "$source" ] || continue
          lock="${source%.md}.lock.yml"
          printf 'compiled-from:%s\n' "$source" > "$lock"
        done
        exit 0
        ;;
    esac
    ;;
esac
exit 0
STUB
chmod +x "$TMPDIR/bin/gh"
ln -sf "$(command -v jq)" "$TMPDIR/bin/jq"
ln -sf "$(command -v yq)" "$TMPDIR/bin/yq"
export PATH="$TMPDIR/bin:$PATH"

bash "$EXPORT_SCRIPT" >/dev/null 2>&1

if ! bash "$BOOTSTRAP_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: Test 1: valid scaffold should pass bootstrap test" >&2
  exit 1
fi
echo "Test 1 passed: valid scaffold passes bootstrap"

CRITICAL="$OUTPUT_DIR/.github/workflows/auto-dispatch.yml"
if [ -f "$CRITICAL" ]; then
  mv "$CRITICAL" "$CRITICAL.bak"
  if bash "$BOOTSTRAP_SCRIPT" >/dev/null 2>&1; then
    echo "FAIL: Test 2: missing auto-dispatch.yml should fail bootstrap" >&2
    mv "$CRITICAL.bak" "$CRITICAL"
    exit 1
  fi
  mv "$CRITICAL.bak" "$CRITICAL"
  echo "Test 2 passed: missing critical file detected"
fi

DEPLOY_PROFILE="$OUTPUT_DIR/.deploy-profile"
if [ -f "$DEPLOY_PROFILE" ]; then
  ORIGINAL=$(cat "$DEPLOY_PROFILE")
  : > "$DEPLOY_PROFILE"
  if bash "$BOOTSTRAP_SCRIPT" >/dev/null 2>&1; then
    echo "FAIL: Test 3: empty .deploy-profile should fail bootstrap" >&2
    printf '%s' "$ORIGINAL" > "$DEPLOY_PROFILE"
    exit 1
  fi
  printf '%s' "$ORIGINAL" > "$DEPLOY_PROFILE"
  echo "Test 3 passed: empty .deploy-profile detected"
fi

WORKFLOW="$OUTPUT_DIR/.github/workflows/auto-dispatch.yml"
if [ -f "$WORKFLOW" ]; then
  cp "$WORKFLOW" "$WORKFLOW.bak"
  printf '\n      - run: bash scripts/does-not-exist.sh\n' >> "$WORKFLOW"
  if bash "$BOOTSTRAP_SCRIPT" >/dev/null 2>&1; then
    echo "FAIL: Test 4: missing referenced script should fail bootstrap" >&2
    mv "$WORKFLOW.bak" "$WORKFLOW"
    exit 1
  fi
  mv "$WORKFLOW.bak" "$WORKFLOW"
  echo "Test 4 passed: missing workflow script reference detected"
fi

LOCK_FILE="$OUTPUT_DIR/.github/workflows/repo-assist.lock.yml"
if [ -f "$LOCK_FILE" ]; then
  cp "$LOCK_FILE" "$LOCK_FILE.bak"
  printf 'stale-lock\n' > "$LOCK_FILE"
  if bash "$BOOTSTRAP_SCRIPT" >/dev/null 2>&1; then
    echo "FAIL: Test 5: stale lock file should fail bootstrap" >&2
    mv "$LOCK_FILE.bak" "$LOCK_FILE"
    exit 1
  fi
  mv "$LOCK_FILE.bak" "$LOCK_FILE"
  echo "Test 5 passed: stale lock file detected"
fi

echo "bootstrap-test tests passed"
