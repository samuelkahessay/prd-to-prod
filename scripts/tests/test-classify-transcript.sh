#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/classify.sh"

# RED guard — test defines the contract before implementation exists
if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# ── Fixtures (file-based to avoid bash 3.2 heredoc-in-subshell issues) ──

cat > "$TMPDIR/greenfield-clear.txt" <<'EOF'
We want to build a new app for tracking inventory. Create a service
that handles warehouse locations. This is a brand new product, no
existing code. We need to start from scratch.
EOF
GREENFIELD_CLEAR=$(cat "$TMPDIR/greenfield-clear.txt")

cat > "$TMPDIR/existing-clear.txt" <<'EOF'
We need to update the dashboard to fix the broken chart on the
analytics page. The repo has a React frontend. The current
implementation at v2.3 needs the API endpoint changed. Fix in the
API the timeout issue our users are reporting.
EOF
EXISTING_CLEAR=$(cat "$TMPDIR/existing-clear.txt")

cat > "$TMPDIR/existing-weak.txt" <<'EOF'
We should add to the system a way to export reports. Maybe change
the layout a bit. Nothing major, just some tweaks.
EOF
EXISTING_WEAK=$(cat "$TMPDIR/existing-weak.txt")

cat > "$TMPDIR/greenfield-weak.txt" <<'EOF'
Let's build a new app for meal planning. Though we could add to
an existing service if that makes more sense.
EOF
GREENFIELD_WEAK=$(cat "$TMPDIR/greenfield-weak.txt")

cat > "$TMPDIR/registry-match.txt" <<'EOF'
The acme-dashboard needs a new sidebar widget. Users are complaining
about the navigation in acme-dashboard being confusing. Let's fix it.
EOF
REGISTRY_MATCH=$(cat "$TMPDIR/registry-match.txt")

# Product registry fixture
cat > "$TMPDIR/product-registry.json" <<'JSON'
{
  "acme-dashboard": "acme/dashboard",
  "billing-service": "acme/billing"
}
JSON

# ── Helpers ───────────────────────────────────────────────────

assert_field() {
  local json="$1" expr="$2" msg="$3"
  printf '%s' "$json" | jq -e "$expr" >/dev/null 2>&1 || {
    echo "FAIL: $msg" >&2
    echo "  got: $(printf '%s' "$json" | jq -c '.')" >&2
    exit 1
  }
}

# ── Test 1: Greenfield high confidence ────────────────────────

OUTPUT=$(printf '%s' "$GREENFIELD_CLEAR" | "$SCRIPT")
assert_field "$OUTPUT" '.classification == "greenfield"' \
  "Test 1: expected classification=greenfield"
assert_field "$OUTPUT" '.confidence == "high"' \
  "Test 1: expected confidence=high"

# ── Test 2: Existing high confidence ─────────────────────────

OUTPUT=$(printf '%s' "$EXISTING_CLEAR" | "$SCRIPT")
assert_field "$OUTPUT" '.classification == "existing"' \
  "Test 2: expected classification=existing"
assert_field "$OUTPUT" '.confidence == "high"' \
  "Test 2: expected confidence=high"

# ── Test 3: Existing low confidence ──────────────────────────

OUTPUT=$(printf '%s' "$EXISTING_WEAK" | "$SCRIPT")
assert_field "$OUTPUT" '.classification == "existing"' \
  "Test 3: expected classification=existing"
assert_field "$OUTPUT" '.confidence == "low"' \
  "Test 3: expected confidence=low"

# ── Test 4: Greenfield low confidence ────────────────────────

OUTPUT=$(printf '%s' "$GREENFIELD_WEAK" | "$SCRIPT")
assert_field "$OUTPUT" '.classification == "greenfield"' \
  "Test 4: expected classification=greenfield"
assert_field "$OUTPUT" '.confidence == "low"' \
  "Test 4: expected confidence=low"

# ── Test 5: Product registry match ───────────────────────────

OUTPUT=$(printf '%s' "$REGISTRY_MATCH" | "$SCRIPT" --product-registry "$TMPDIR/product-registry.json")
assert_field "$OUTPUT" '.product_match == "acme/dashboard"' \
  "Test 5: expected product_match=acme/dashboard"

# ── Test 6: Product registry miss ────────────────────────────

OUTPUT=$(printf '%s' "$GREENFIELD_CLEAR" | "$SCRIPT" --product-registry "$TMPDIR/product-registry.json")
assert_field "$OUTPUT" '.product_match == null' \
  "Test 6: expected product_match=null with no matching product"

# ── Test 7: No registry provided ─────────────────────────────

OUTPUT=$(printf '%s' "$REGISTRY_MATCH" | "$SCRIPT")
assert_field "$OUTPUT" '.product_match == null' \
  "Test 7: expected product_match=null when no registry flag given"

# ── Test 8: Valid JSON output (all four fields) ──────────────

OUTPUT=$(printf '%s' "$GREENFIELD_CLEAR" | "$SCRIPT")
assert_field "$OUTPUT" 'has("classification")' \
  "Test 8: missing field: classification"
assert_field "$OUTPUT" 'has("confidence")' \
  "Test 8: missing field: confidence"
assert_field "$OUTPUT" 'has("signals")' \
  "Test 8: missing field: signals"
assert_field "$OUTPUT" 'has("product_match")' \
  "Test 8: missing field: product_match"

# ── Test 9: Signals array populated ──────────────────────────

OUTPUT=$(printf '%s' "$EXISTING_CLEAR" | "$SCRIPT")
assert_field "$OUTPUT" '.signals | length > 0' \
  "Test 9: expected non-empty signals array"

# ── Test 10: Empty/minimal transcript → greenfield/low ───────

OUTPUT=$(printf '%s' "" | "$SCRIPT")
assert_field "$OUTPUT" '.classification == "greenfield"' \
  "Test 10: empty transcript should default to greenfield"
assert_field "$OUTPUT" '.confidence == "low"' \
  "Test 10: empty transcript should have low confidence"

# ── Test 11: File path input ─────────────────────────────────

echo "$EXISTING_CLEAR" > "$TMPDIR/transcript.txt"
OUTPUT=$("$SCRIPT" "$TMPDIR/transcript.txt")
assert_field "$OUTPUT" '.classification == "existing"' \
  "Test 11: file path input should classify same as stdin"

# ── Test 12: Deterministic ───────────────────────────────────

RUN1=$(printf '%s' "$EXISTING_CLEAR" | "$SCRIPT")
RUN2=$(printf '%s' "$EXISTING_CLEAR" | "$SCRIPT")
if [ "$RUN1" != "$RUN2" ]; then
  echo "FAIL: Test 12: two runs on same input produced different output" >&2
  echo "  run1: $RUN1" >&2
  echo "  run2: $RUN2" >&2
  exit 1
fi

echo "classify-transcript.sh tests passed"
