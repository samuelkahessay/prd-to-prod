#!/usr/bin/env bash
set -euo pipefail

# export-scaffold.sh — Materializes dist/scaffold/ from template-manifest.yml
#
# Copies allowlisted paths from the repo into dist/scaffold/, applies manifest
# rename/render rules, and compiles workflow lock files inside the scaffold.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SCRIPT_DIR/template-manifest.yml"
OUTPUT_DIR="$REPO_ROOT/dist/scaffold"

[ -f "$MANIFEST" ] || { echo "FAIL: Manifest not found: $MANIFEST" >&2; exit 1; }
command -v yq >/dev/null 2>&1 || { echo "FAIL: yq is required but not installed" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "FAIL: gh is required but not installed" >&2; exit 1; }
gh aw --help >/dev/null 2>&1 || { echo "FAIL: gh-aw extension is required for scaffold compilation" >&2; exit 1; }

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

copy_path() {
  local src="$1"
  local dest="$OUTPUT_DIR/$src"

  if [[ "$src" == */ ]] || [ -d "$REPO_ROOT/$src" ]; then
    [ -d "$REPO_ROOT/$src" ] || return 0
    mkdir -p "$dest"
    (cd "$REPO_ROOT" && find "$src" -type f \
      ! -path "*/node_modules/*" \
      ! -path "*/.next/*" \
      ! -path "*/.git/*" \
      ! -name ".DS_Store" \
      | while IFS= read -r file; do
        mkdir -p "$OUTPUT_DIR/$(dirname "$file")"
        cp "$REPO_ROOT/$file" "$OUTPUT_DIR/$file"
      done)
    return
  fi

  [ -f "$REPO_ROOT/$src" ] || return 0
  mkdir -p "$(dirname "$dest")"
  cp "$REPO_ROOT/$src" "$dest"
}

while IFS= read -r path; do
  [ -n "$path" ] || continue
  copy_path "$(printf '%s' "$path" | xargs)"
done < <(yq -r '.include[]' "$MANIFEST")

while IFS=$'\t' read -r src dest; do
  [ -n "${src:-}" ] || continue
  [ -f "$OUTPUT_DIR/$src" ] || continue
  mkdir -p "$(dirname "$OUTPUT_DIR/$dest")"
  mv "$OUTPUT_DIR/$src" "$OUTPUT_DIR/$dest"
done < <(yq -r '.rename // {} | to_entries[] | "\(.key)\t\(.value)"' "$MANIFEST" 2>/dev/null || true)

RENDER_JSON=$(yq -o=json '.render // {}' "$MANIFEST")
python3 - "$OUTPUT_DIR" "$RENDER_JSON" <<'PY'
from pathlib import Path
import json
import sys

output_dir = Path(sys.argv[1])
render_map = json.loads(sys.argv[2])
text_suffixes = {".md", ".yml", ".yaml", ".json", ".sh", ".ts", ".tsx", ".js"}

for file_path in output_dir.rglob("*"):
    if not file_path.is_file() or file_path.suffix not in text_suffixes:
        continue
    content = file_path.read_text()
    original = content
    for key, value in render_map.items():
        if isinstance(value, dict) and "defaults" in value:
            for nested_key, nested_value in value["defaults"].items():
                content = content.replace(f"{{{{{nested_key}}}}}", str(nested_value))
        else:
            content = content.replace(f"{{{{{key}}}}}", str(value))
    if content != original:
        file_path.write_text(content)
PY

if find "$OUTPUT_DIR/.github/workflows" -maxdepth 1 -name "*.md" | grep -q .; then
  (
    cd "$OUTPUT_DIR"
    git init -q >/dev/null 2>&1 || true
    if ! gh aw compile >/dev/null 2>&1; then
      :
    fi
    gh aw compile >/dev/null 2>&1
  ) || { echo "FAIL: gh aw compile failed inside scaffold export" >&2; exit 1; }
fi

rm -rf "$OUTPUT_DIR/.git"
rm -f "$OUTPUT_DIR/.gitattributes"

FILE_COUNT=$(find "$OUTPUT_DIR" -type f | wc -l | xargs)
echo "Scaffold exported: $FILE_COUNT files → $OUTPUT_DIR"
