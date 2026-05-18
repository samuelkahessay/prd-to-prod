#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/scan-sensitive-output.sh"

[ -x "$SCRIPT" ] || {
  echo "FAIL: scripts/scan-sensitive-output.sh must exist and be executable" >&2
  exit 1
}

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

cat > "$TMPDIR/safe.md" <<'EOF'
This comment mentions the secret name COPILOT_GITHUB_TOKEN but not its value.
EOF
"$SCRIPT" "$TMPDIR/safe.md" >/dev/null

printf 'This generated PR body references %s private implementation details.\n' "Aur""rin" > "$TMPDIR/private-instance.md"
if "$SCRIPT" "$TMPDIR/private-instance.md" >/dev/null 2>&1; then
  echo "FAIL: private instance references must be rejected" >&2
  exit 1
fi

printf 'token=%s\n' "ghp_""abcdefghijklmnopqrstuvwxyz1234567890" > "$TMPDIR/token.md"
if "$SCRIPT" "$TMPDIR/token.md" >/dev/null 2>&1; then
  echo "FAIL: concrete token values must be rejected" >&2
  exit 1
fi

printf -- '-----%s %s KEY-----\n' "BEGIN" "PRIVATE" > "$TMPDIR/private-key.md"
if "$SCRIPT" "$TMPDIR/private-key.md" >/dev/null 2>&1; then
  echo "FAIL: private key material must be rejected" >&2
  exit 1
fi

"$SCRIPT" \
  "$ROOT_DIR/README.template.md" \
  "$ROOT_DIR/docs/ARCHITECTURE.md" \
  "$ROOT_DIR/.github/workflows/prd-decomposer.md" \
  "$ROOT_DIR/.github/workflows/repo-assist.md" >/dev/null

grep -F "scripts/scan-sensitive-output.sh" "$ROOT_DIR/scaffold/leak-test.sh" >/dev/null || {
  echo "FAIL: scaffold leak-test must run sensitive output scan" >&2
  exit 1
}

echo "agent output secret scan tests passed"
