#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/demo-preflight.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/bin"
LOG_FILE="$TMPDIR/calls.log"
: > "$LOG_FILE"

# Create fake drill evidence with a PASS verdict
mkdir -p "$TMPDIR/drills/reports"
echo '{"verdict":"PASS","run":"mock"}' > "$TMPDIR/drills/reports/mock-drill.json"

# Stub bash (for sub-shell checks like live checks)
cat > "$TMPDIR/bin/bash" <<'EOF'
#!/bin/bash
printf 'bash %s\n' "$*" >> "$LOG_FILE"
exit 0
EOF

# Stub dotnet
cat > "$TMPDIR/bin/dotnet" <<'EOF'
#!/bin/bash
printf 'dotnet %s\n' "$*" >> "$LOG_FILE"
exit 0
EOF

# Stub check-policy.sh to succeed
cat > "$TMPDIR/bin/check-policy.sh-stub" <<'EOF'
#!/bin/bash
printf 'check-policy validate\n' >> "$LOG_FILE"
echo "OK: autonomy-policy.yml is valid"
exit 0
EOF

chmod +x "$TMPDIR/bin/bash" "$TMPDIR/bin/dotnet"

export LOG_FILE

run_and_capture() {
  : > "$LOG_FILE"
  # Override REPO_ROOT to use our stub drills directory, and override path
  REPO_ROOT="$TMPDIR" PATH="$TMPDIR/bin:$PATH" /bin/bash "$SCRIPT" "$@" 2>&1 || true
}

# ---- Test default mode (with --skip-live to avoid network calls in CI) ----
OUTPUT=$(run_and_capture --skip-live)

# Should call dotnet build
if ! printf '%s\n' "$OUTPUT" | grep -qiF "build"; then
  echo "FAIL: Expected build check in output" >&2
  exit 1
fi

# Should call dotnet test
if ! printf '%s\n' "$OUTPUT" | grep -qiF "test"; then
  echo "FAIL: Expected test check in output" >&2
  exit 1
fi

# Should include policy check step label
if ! printf '%s\n' "$OUTPUT" | grep -qF "Policy:"; then
  echo "FAIL: Expected Policy check label in output" >&2
  exit 1
fi

# Should include drill evidence check
if ! printf '%s\n' "$OUTPUT" | grep -qiF "drill"; then
  echo "FAIL: Expected drill evidence check in output" >&2
  exit 1
fi

# Should include MVP check
if ! printf '%s\n' "$OUTPUT" | grep -qiF "MVP"; then
  echo "FAIL: Expected MVP check in output" >&2
  exit 1
fi

# ---- Test --skip-live suppresses live checks ----
OUTPUT_SKIP=$(run_and_capture --skip-live)
if printf '%s\n' "$OUTPUT_SKIP" | grep -qi "Live:"; then
  echo "FAIL: --skip-live should suppress Live checks" >&2
  exit 1
fi

echo "demo-preflight.sh tests passed"
