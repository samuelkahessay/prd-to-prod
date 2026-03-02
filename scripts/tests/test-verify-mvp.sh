#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/verify-mvp.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/bin"
LOG_FILE="$TMPDIR/calls.log"

cat > "$TMPDIR/bin/bash" <<EOF
#!/bin/bash
printf 'bash %s\n' "\$*" >> "$LOG_FILE"
exit 0
EOF

cat > "$TMPDIR/bin/dotnet" <<EOF
#!/bin/bash
printf 'dotnet %s\n' "\$*" >> "$LOG_FILE"
exit 0
EOF

chmod +x "$TMPDIR/bin/bash" "$TMPDIR/bin/dotnet"

run_and_capture() {
  : > "$LOG_FILE"
  PATH="$TMPDIR/bin:$PATH" /bin/bash "$SCRIPT" "$@" >/dev/null
  cat "$LOG_FILE"
}

DEFAULT_CALLS=$(run_and_capture)
printf '%s\n' "$DEFAULT_CALLS" | grep -F "bash scripts/self-healing-drill.sh audit ff2f18746416dfb8ae8bfe1e414e031983a5fb73" >/dev/null

SKIP_CALLS=$(run_and_capture --skip-audit)
if printf '%s\n' "$SKIP_CALLS" | grep -F "bash scripts/self-healing-drill.sh audit" >/dev/null; then
  echo "FAIL: --skip-audit should suppress the drill audit" >&2
  exit 1
fi

OVERRIDE_CALLS=$(run_and_capture --audit-commit abc123)
printf '%s\n' "$OVERRIDE_CALLS" | grep -F "bash scripts/self-healing-drill.sh audit abc123" >/dev/null

echo "verify-mvp.sh tests passed"
