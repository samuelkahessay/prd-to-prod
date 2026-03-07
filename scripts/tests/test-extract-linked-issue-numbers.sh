#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/extract-linked-issue-numbers.sh"
REPO="samuelkahessay/prd-to-prod"

BODY=$(cat <<'EOF'
Closes #406
Fixes samuelkahessay/prd-to-prod#407
Resolves other/repo#408
Fixes #406
EOF
)

OUTPUT=$(printf '%s' "$BODY" | bash "$SCRIPT" "$REPO")
EXPECTED=$(printf '406\n407\n')

if [ "$OUTPUT" != "$EXPECTED" ]; then
  echo "FAIL: expected linked issue extraction to preserve order, dedupe, and ignore other repos" >&2
  printf 'Expected:\n%s\nActual:\n%s\n' "$EXPECTED" "$OUTPUT" >&2
  exit 1
fi

ALL_OUTPUT=$(printf '%s' "$BODY" | bash "$SCRIPT")
printf '%s\n' "$ALL_OUTPUT" | grep -qx '408'

echo "extract-linked-issue-numbers.sh tests passed"
