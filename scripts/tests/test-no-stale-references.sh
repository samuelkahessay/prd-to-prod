#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
ERRORS=0

# Check for stale references to old repos in active code
# prd-to-prod-template references are stale everywhere
for file in trigger/*.sh README.md docs/ARCHITECTURE.md; do
  filepath="$ROOT_DIR/$file"
  [ -f "$filepath" ] || continue
  if grep -qF "prd-to-prod-template" "$filepath"; then
    echo "STALE: $file contains reference to 'prd-to-prod-template'"
    ((ERRORS++))
  fi
done

# meeting-to-main references are stale in trigger/ and ARCHITECTURE.md
# but acceptable in README.md (product description)
for pattern in "meeting-to-main"; do
  for file in trigger/*.sh docs/ARCHITECTURE.md; do
    filepath="$ROOT_DIR/$file"
    [ -f "$filepath" ] || continue
    if rg -n -P "${pattern}(?!:)" "$filepath" >/dev/null 2>&1; then
      echo "STALE: $file contains reference to '$pattern'"
      ((ERRORS++))
    fi
  done
done

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS stale reference(s) found"
  exit 1
fi

echo "no-stale-references tests passed"
