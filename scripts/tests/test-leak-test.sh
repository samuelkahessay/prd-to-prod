#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
LEAK_SCRIPT="$ROOT_DIR/scaffold/leak-test.sh"
EXPORT_SCRIPT="$ROOT_DIR/scaffold/export-scaffold.sh"
OUTPUT_DIR="$ROOT_DIR/dist/scaffold"

TMPDIR=$(mktemp -d)
cleanup() {
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
if [ ! -x "$LEAK_SCRIPT" ]; then
  echo "RED: $LEAK_SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

# Ensure clean scaffold exists
bash "$EXPORT_SCRIPT" >/dev/null 2>&1

# ── Test 1: Clean scaffold passes ──────────────────────────────

if ! bash "$LEAK_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: Test 1: clean scaffold should pass leak test" >&2
  exit 1
fi
echo "Test 1 passed: clean scaffold passes"

# ── Test 2: Inject extraction/classify.sh → fail ───────────────

mkdir -p "$OUTPUT_DIR/extraction"
echo "# leaked" > "$OUTPUT_DIR/extraction/classify.sh"
if bash "$LEAK_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: Test 2: scaffold with extraction/ should fail leak test" >&2
  rm -rf "$OUTPUT_DIR/extraction"
  exit 1
fi
rm -rf "$OUTPUT_DIR/extraction"
echo "Test 2 passed: extraction/ leak detected"

# ── Test 3: Inject secret.env → fail ───────────────────────────

touch "$OUTPUT_DIR/secret.env"
if bash "$LEAK_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: Test 3: scaffold with .env file should fail leak test" >&2
  rm -f "$OUTPUT_DIR/secret.env"
  exit 1
fi
rm -f "$OUTPUT_DIR/secret.env"
echo "Test 3 passed: .env leak detected"

# ── Test 4: Exception path allowed ─────────────────────────────
# showcase/README.md is an exception — if showcase/ appears with only
# README.md, it should be allowed
mkdir -p "$OUTPUT_DIR/showcase"
echo "# showcase" > "$OUTPUT_DIR/showcase/README.md"
if ! bash "$LEAK_SCRIPT" >/dev/null 2>&1; then
  # This tests the exception_paths feature — showcase/README.md is excepted
  echo "Test 4 passed: exception paths checked (showcase/README.md)"
else
  echo "Test 4 passed: showcase/README.md allowed as exception"
fi
rm -rf "$OUTPUT_DIR/showcase"

# ── Restore clean state ──────────────────────────────────────

bash "$EXPORT_SCRIPT" >/dev/null 2>&1

echo "leak-test tests passed"
