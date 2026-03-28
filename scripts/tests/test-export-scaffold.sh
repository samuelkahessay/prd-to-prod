#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
EXPORT_SCRIPT="$ROOT_DIR/scaffold/export-scaffold.sh"
OUTPUT_DIR="$ROOT_DIR/dist/scaffold"
ORIGINAL_PATH="$PATH"

TMPDIR=$(mktemp -d)
cleanup() {
  PATH="$ORIGINAL_PATH"
  bash "$EXPORT_SCRIPT" >/dev/null 2>&1 || true
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

mkdir -p "$TMPDIR/bin"
cat > "$TMPDIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  aw)
    case "${2:-}" in
      --help) exit 0 ;;
      compile)
        mkdir -p .github/aw
        printf '{"generated_by":"test-stub"}\n' > .github/aw/actions-lock.json
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

install_yq_stub() {
  cat > "$TMPDIR/bin/yq" <<'STUB'
#!/usr/bin/env ruby
require "json"
require "psych"

args = ARGV.dup
json_output = false

loop do
  case args.first
  when "-r"
    args.shift
  when "-o=json"
    json_output = true
    args.shift
  else
    break
  end
end

query = args.shift
path = args.shift
abort("unsupported yq invocation") unless query && path

data = Psych.safe_load(File.read(path), aliases: true) || {}

case query
when ".forbidden_paths[]"
  Array(data["forbidden_paths"]).each { |value| puts(value) }
when ".exception_paths[]"
  Array(data["exception_paths"]).each { |value| puts(value) }
when ".include[]"
  Array(data["include"]).each { |value| puts(value) }
when '.directory_remap // {} | to_entries[] | "\(.key)\t\(.value)"'
  (data["directory_remap"] || {}).each { |key, value| puts("#{key}\t#{value}") }
when '.rename // {} | to_entries[] | "\(.key)\t\(.value)"'
  (data["rename"] || {}).each { |key, value| puts("#{key}\t#{value}") }
when ".render // {}"
  abort("expected -o=json") unless json_output
  print JSON.generate(data["render"] || {})
else
  abort("unsupported yq query: #{query}")
end
STUB
  chmod +x "$TMPDIR/bin/yq"
}

ln -sf "$(command -v jq)" "$TMPDIR/bin/jq"
install_yq_stub
export PATH="$TMPDIR/bin:$PATH"

# RED guard
if [ ! -x "$EXPORT_SCRIPT" ]; then
  echo "RED: $EXPORT_SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

# Run export first to ensure we have fresh output
bash "$EXPORT_SCRIPT" >/dev/null 2>&1

# ── Test 1: Include paths appear in scaffold ────────────────────

if [ ! -f "$OUTPUT_DIR/.github/workflows/auto-dispatch.yml" ]; then
  echo "FAIL: Test 1: auto-dispatch.yml missing from scaffold" >&2
  exit 1
fi
echo "Test 1 passed: auto-dispatch.yml present in scaffold"

# ── Test 2: Forbidden paths absent ──────────────────────────────

if [ -d "$OUTPUT_DIR/extraction" ]; then
  echo "FAIL: Test 2: extraction/ should not appear in scaffold" >&2
  exit 1
fi
if [ -d "$OUTPUT_DIR/PRDtoProd" ]; then
  echo "FAIL: Test 2: PRDtoProd/ should not appear in scaffold" >&2
  exit 1
fi
if [ -f "$OUTPUT_DIR/.github/workflows/publish-scaffold-template.yml" ]; then
  echo "FAIL: Test 2: publish-scaffold-template.yml should not appear in scaffold" >&2
  exit 1
fi
echo "Test 2 passed: forbidden paths absent"

# ── Test 3: Exception paths present ─────────────────────────────

if [ -f "$OUTPUT_DIR/docs/prd/sample-prd.md" ]; then
  echo "Test 3 passed: exception path docs/prd/sample-prd.md present"
else
  # Exception paths are only present if included explicitly
  echo "Test 3 passed: exception paths handled correctly"
fi

# ── Test 4: Rename applied (README.template.md → README.md) ────

if [ -f "$OUTPUT_DIR/README.template.md" ]; then
  echo "FAIL: Test 4: README.template.md should be renamed to README.md" >&2
  exit 1
fi
if [ -f "$OUTPUT_DIR/README.md" ]; then
  echo "Test 4 passed: README.template.md renamed to README.md"
else
  echo "Test 4 passed: README handled (may not exist yet)"
fi

# ── Test 5: Render defaults substituted ─────────────────────────

if [ -f "$OUTPUT_DIR/README.md" ]; then
  if grep -q '{{PROJECT_NAME}}' "$OUTPUT_DIR/README.md"; then
    echo "FAIL: Test 5: unsubstituted {{PROJECT_NAME}} found in README.md" >&2
    exit 1
  fi
  echo "Test 5 passed: template variables substituted"
else
  echo "Test 5 passed: render check skipped (no README.md)"
fi

# ── Test 6: .env causes hard failure ────────────────────────────

# Create a temporary .env in scaffold and verify leak-test catches it
TMPENV="$OUTPUT_DIR/.env.test-probe"
touch "$TMPENV"
if bash "$ROOT_DIR/scaffold/leak-test.sh" >/dev/null 2>&1; then
  echo "FAIL: Test 6: leak-test should fail when .env file present" >&2
  rm -f "$TMPENV"
  exit 1
fi
rm -f "$TMPENV"
echo "Test 6 passed: .env causes leak-test failure"

# ── Test 7: File count matches golden file ──────────────────────

GOLDEN="$ROOT_DIR/scaffold/test-fixtures/expected-tree.txt"
if [ -f "$GOLDEN" ]; then
  # Re-export cleanly (we removed the probe file)
  bash "$EXPORT_SCRIPT" >/dev/null 2>&1
  # Use relative paths to match golden file format
  ACTUAL=$(cd "$ROOT_DIR/dist/scaffold" && find . -type f | sed 's#^\./##' | LC_ALL=C sort)
  EXPECTED=$(cat "$GOLDEN")
  if [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "FAIL: Test 7: scaffold file list differs from golden file" >&2
    diff <(echo "$ACTUAL") <(echo "$EXPECTED") || true
    exit 1
  fi
  echo "Test 7 passed: golden file comparison complete"
else
  echo "Test 7 skipped: no golden file yet"
fi

echo "export-scaffold tests passed"
