#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/validate-deployment.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/bin"
cat > "$TMPDIR/bin/curl" <<'STUB'
#!/usr/bin/env bash
cat <<'JSON'
{"status":"ok"}
JSON
STUB
chmod +x "$TMPDIR/bin/curl"
ln -sf "$(command -v jq)" "$TMPDIR/bin/jq"
export PATH="$TMPDIR/bin:$PATH"
export OPENROUTER_API_KEY="test-key"
export DEPLOYMENT_URL="https://example.com"
export ISSUE_NUMBERS="12,13"
export REPO="acme/reports"

OUTPUT=$(bash "$SCRIPT")
printf '%s' "$OUTPUT" | bash "$ROOT_DIR/extraction/validate-schema.sh" "$ROOT_DIR/extraction/schemas/validation-result.json" - >/dev/null || {
  echo "FAIL: validate-deployment output must match schema" >&2
  exit 1
}

set +e
OUTPUT_FAIL=$(PATH="$TMPDIR/bin:$PATH" DEPLOYMENT_URL="https://broken.example.com" ISSUE_NUMBERS="12,13" REPO="acme/reports" bash -c '
  cat > "'"$TMPDIR"'/bin/curl" <<'"'"'STUB'"'"'
#!/usr/bin/env bash
exit 1
STUB
  chmod +x "'"$TMPDIR"'/bin/curl"
  bash "'"$SCRIPT"'"
')
RC=$?
set -e
[ "$RC" -eq 2 ] || {
  echo "FAIL: validate-deployment should exit 2 on fetch failure" >&2
  exit 1
}
printf '%s' "$OUTPUT_FAIL" | bash "$ROOT_DIR/extraction/validate-schema.sh" "$ROOT_DIR/extraction/schemas/validation-result.json" - >/dev/null || {
  echo "FAIL: infrastructure failure output must still match schema" >&2
  exit 1
}

echo "validate-deployment tests passed"
