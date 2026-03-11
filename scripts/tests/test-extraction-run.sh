#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/run.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/extraction" "$TMPDIR/trigger"
cp "$SCRIPT" "$TMPDIR/extraction/run.sh"
chmod +x "$TMPDIR/extraction/run.sh"

CALL_LOG="$TMPDIR/call.log"
export CALL_LOG

cat > "$TMPDIR/extraction/classify.sh" <<'STUB'
#!/usr/bin/env bash
echo "classify.sh called" >> "$CALL_LOG"
cat "$CLASSIFY_RESPONSE"
STUB
chmod +x "$TMPDIR/extraction/classify.sh"

cat > "$TMPDIR/extraction/extract-prd.sh" <<'STUB'
#!/usr/bin/env bash
echo "extract-prd.sh called" >> "$CALL_LOG"
exit 0
STUB
chmod +x "$TMPDIR/extraction/extract-prd.sh"

cat > "$TMPDIR/extraction/extract-issues.sh" <<'STUB'
#!/usr/bin/env bash
echo "extract-issues.sh called" >> "$CALL_LOG"
printf '[{"title":"Existing repo change","description":"Patch the current repo","acceptance_criteria":["Route issue creation into TARGET_REPO"],"type":"feature","dependencies":[],"technical_notes":{"current_state":"Feature missing","gap":"No v2 handoff yet","complexity":"Medium","estimated_effort":"Small","implementation_steps":["Create issue in target repo"]}}]\n'
STUB
chmod +x "$TMPDIR/extraction/extract-issues.sh"

cat > "$TMPDIR/trigger/push-to-existing.sh" <<'STUB'
#!/usr/bin/env bash
echo "push-to-existing.sh called" >> "$CALL_LOG"
exit 0
STUB
chmod +x "$TMPDIR/trigger/push-to-existing.sh"

cat > "$TMPDIR/classify-greenfield.json" <<'JSON'
{"classification":"greenfield","confidence":"high","signals":["build a new app"],"product_match":null}
JSON

cat > "$TMPDIR/classify-existing-high.json" <<'JSON'
{"classification":"existing","confidence":"high","signals":["update the dashboard"],"product_match":null}
JSON

cat > "$TMPDIR/classify-existing-high-with-match.json" <<'JSON'
{"classification":"existing","confidence":"high","signals":["the acme-dashboard"],"product_match":"acme/dashboard"}
JSON

cat > "$TMPDIR/classify-existing-low.json" <<'JSON'
{"classification":"existing","confidence":"low","signals":["add to"],"product_match":null}
JSON

cat > "$TMPDIR/classify-existing-low-with-match.json" <<'JSON'
{"classification":"existing","confidence":"low","signals":["the acme-dashboard"],"product_match":"acme/dashboard"}
JSON

RUN_SH="$TMPDIR/extraction/run.sh"

run_case() {
  : > "$CALL_LOG"
  local env_vars=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    env_vars+=("$1")
    shift
  done
  [ "${1:-}" = "--" ] && shift

  if [ "${#env_vars[@]}" -gt 0 ]; then
    env "${env_vars[@]}" /bin/bash "$RUN_SH" "$@" > "$TMPDIR/stdout.log" 2> "$TMPDIR/stderr.log" || true
  else
    /bin/bash "$RUN_SH" "$@" > "$TMPDIR/stdout.log" 2> "$TMPDIR/stderr.log" || true
  fi
}

assert_called() {
  local name="$1" test_num="$2"
  grep -q "$name called" "$CALL_LOG" || {
    echo "FAIL: Test $test_num: expected $name to be called" >&2
    echo "  call log: $(cat "$CALL_LOG")" >&2
    exit 1
  }
}

assert_not_called() {
  local name="$1" test_num="$2"
  ! grep -q "$name called" "$CALL_LOG" || {
    echo "FAIL: Test $test_num: expected $name NOT to be called" >&2
    echo "  call log: $(cat "$CALL_LOG")" >&2
    exit 1
  }
}

assert_stderr_contains() {
  local pattern="$1" test_num="$2"
  grep -q "$pattern" "$TMPDIR/stderr.log" || {
    echo "FAIL: Test $test_num: expected stderr to contain '$pattern'" >&2
    echo "  stderr: $(cat "$TMPDIR/stderr.log")" >&2
    exit 1
  }
}

assert_exit_nonzero() {
  local test_num="$1"
  shift
  : > "$CALL_LOG"
  local env_vars=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    env_vars+=("$1")
    shift
  done
  [ "${1:-}" = "--" ] && shift

  local rc=0
  if [ "${#env_vars[@]}" -gt 0 ]; then
    env "${env_vars[@]}" /bin/bash "$RUN_SH" "$@" > "$TMPDIR/stdout.log" 2> "$TMPDIR/stderr.log" || rc=$?
  else
    /bin/bash "$RUN_SH" "$@" > "$TMPDIR/stdout.log" 2> "$TMPDIR/stderr.log" || rc=$?
  fi
  if [ "$rc" -eq 0 ]; then
    echo "FAIL: Test $test_num: expected non-zero exit" >&2
    exit 1
  fi
}

run_case "CLASSIFY_RESPONSE=$TMPDIR/classify-greenfield.json" --
assert_called "classify.sh" 1
assert_called "extract-prd.sh" 1
assert_not_called "extract-issues.sh" 1
assert_not_called "push-to-existing.sh" 1

run_case "CLASSIFY_RESPONSE=$TMPDIR/classify-greenfield.json" -- --mode auto
assert_called "classify.sh" 2
assert_called "extract-prd.sh" 2
assert_not_called "extract-issues.sh" 2

run_case -- --mode greenfield
assert_not_called "classify.sh" 3
assert_called "extract-prd.sh" 3
assert_not_called "extract-issues.sh" 3

assert_exit_nonzero 4 -- --mode existing
assert_stderr_contains "TARGET_REPO required" 4

run_case "TARGET_REPO=acme/repo" --
assert_not_called "classify.sh" 5
assert_called "extract-issues.sh" 5
assert_called "push-to-existing.sh" 5
assert_not_called "extract-prd.sh" 5

run_case "TARGET_REPO=acme/repo" -- --mode auto
assert_not_called "classify.sh" 6
assert_called "extract-issues.sh" 6
assert_called "push-to-existing.sh" 6
assert_not_called "extract-prd.sh" 6

run_case "TARGET_REPO=acme/repo" -- --mode greenfield
assert_called "extract-prd.sh" 7
assert_not_called "extract-issues.sh" 7
assert_not_called "push-to-existing.sh" 7

run_case "TARGET_REPO=acme/repo" -- --mode existing
assert_not_called "classify.sh" 8
assert_called "extract-issues.sh" 8
assert_called "push-to-existing.sh" 8
assert_not_called "extract-prd.sh" 8

assert_exit_nonzero 9 "CLASSIFY_RESPONSE=$TMPDIR/classify-existing-high.json"
assert_stderr_contains "Classification returned 'existing' but TARGET_REPO is not set" 9

assert_exit_nonzero 10 "CLASSIFY_RESPONSE=$TMPDIR/classify-existing-high-with-match.json"
assert_stderr_contains "TARGET_REPO=acme/dashboard" 10

run_case "CLASSIFY_RESPONSE=$TMPDIR/classify-existing-low.json" --
assert_called "extract-prd.sh" 11
assert_not_called "extract-issues.sh" 11
assert_not_called "push-to-existing.sh" 11
assert_stderr_contains "defaulting to greenfield" 11

run_case "CLASSIFY_RESPONSE=$TMPDIR/classify-existing-low-with-match.json" --
assert_called "extract-prd.sh" 12
assert_not_called "extract-issues.sh" 12
assert_not_called "push-to-existing.sh" 12
assert_stderr_contains "TARGET_REPO=acme/dashboard" 12

echo "extraction-run.sh tests passed"
