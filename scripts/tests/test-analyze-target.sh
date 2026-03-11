#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/analyze-target.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat > "$TMPDIR/requirements.json" <<'JSON'
[
  {
    "title": "Add export button",
    "description": "Users need to export reports.",
    "acceptance_criteria": ["Reports can be exported as CSV."],
    "type": "feature",
    "dependencies": []
  }
]
JSON

mkdir -p "$TMPDIR/bin"
CALL_LOG="$TMPDIR/call.log"
export CALL_LOG

cat > "$TMPDIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "gh $*" >> "$CALL_LOG"
case "$*" in
  *"repos/acme/reports --jq .default_branch"*) echo "trunk" ;;
  *"git/trees/trunk?recursive=1"*)
    cat <<'JSON'
{"tree":[{"path":"src/reports.ts","type":"blob"},{"path":"README.md","type":"blob"}]}
JSON
    ;;
  *"contents/src/reports.ts?ref=trunk"*)
    printf '{"content":"ZXhwb3J0IGNvbnN0IHJlcG9ydHMgPSBbXTsK","encoding":"base64"}\n'
    ;;
esac
STUB
chmod +x "$TMPDIR/bin/gh"

cat > "$TMPDIR/bin/curl" <<'STUB'
#!/usr/bin/env bash
echo "curl $*" >> "$CALL_LOG"
if ! grep -q "stage2" "$CALL_LOG"; then
  echo "stage2" >> "$CALL_LOG"
  cat <<'JSON'
{"choices":[{"message":{"content":"{\"files\":[{\"path\":\"src/reports.ts\",\"reason\":\"Report logic lives here.\"}]}"}}]}
JSON
else
  cat <<'JSON'
{"choices":[{"message":{"content":"{\"requirement\":\"Reports can be exported as CSV.\",\"currentState\":\"src/reports.ts exposes report data but no CSV export.\",\"gap\":\"CSV export is missing.\",\"suggestedAction\":\"Add a CSV serializer and route.\",\"affectedFiles\":[\"src/reports.ts\"],\"severity\":\"major\"}"}}]}
JSON
fi
STUB
chmod +x "$TMPDIR/bin/curl"
ln -sf "$(command -v jq)" "$TMPDIR/bin/jq"
export PATH="$TMPDIR/bin:$PATH"
export TARGET_REPO="acme/reports"
export OPENROUTER_API_KEY="test-key"

OUTPUT=$(bash "$SCRIPT" "$TMPDIR/requirements.json")
printf '%s' "$OUTPUT" | jq -e '.[0].gapAnalysis.gap == "CSV export is missing."' >/dev/null || {
  echo "FAIL: expected gap analysis output to be enriched" >&2
  exit 1
}
grep -q "git/trees/trunk?recursive=1" "$CALL_LOG" || {
  echo "FAIL: expected default branch resolution to use trunk" >&2
  exit 1
}

echo "analyze-target tests passed"
