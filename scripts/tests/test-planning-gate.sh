#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
DECOMPOSER="$ROOT_DIR/.github/workflows/prd-decomposer.md"
ARCH="$ROOT_DIR/docs/ARCHITECTURE.md"

for text in \
  "## Planning Gate" \
  "architecture-approved" \
  "planning-skip:v1" \
  "Do not create issues" \
  "Run /plan" \
  "Before the create-issue calls"; do
  grep -F "$text" "$DECOMPOSER" >/dev/null || {
    echo "FAIL: prd-decomposer.md missing planning gate text: $text" >&2
    exit 1
  }
done

if grep -F "Fall back to current behavior" "$DECOMPOSER" >/dev/null; then
  echo "FAIL: prd-decomposer.md must not fall back to unplanned decomposition" >&2
  exit 1
fi

grep -F "architecture-skip-approved" "$ROOT_DIR/scripts/bootstrap.sh" >/dev/null || {
  echo "FAIL: bootstrap.sh must create the architecture-skip-approved label" >&2
  exit 1
}

grep -F "Planning is mandatory" "$ARCH" >/dev/null || {
  echo "FAIL: docs/ARCHITECTURE.md must document mandatory planning" >&2
  exit 1
}

grep -F "planning-skip:v1" "$ARCH" >/dev/null || {
  echo "FAIL: docs/ARCHITECTURE.md must document the low-risk skip marker" >&2
  exit 1
}

echo "planning gate tests passed"
