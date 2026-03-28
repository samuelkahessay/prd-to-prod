#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-$(pwd)}"

has_next_config() {
  local candidate="${1:?candidate directory is required}"
  [ -f "$candidate/next.config.js" ] || \
    [ -f "$candidate/next.config.mjs" ] || \
    [ -f "$candidate/next.config.ts" ]
}

for candidate in "$REPO_ROOT/web" "$REPO_ROOT"; do
  if [ -f "$candidate/package.json" ] && has_next_config "$candidate"; then
    if [ "$candidate" = "$REPO_ROOT" ]; then
      echo "."
    else
      basename "$candidate"
    fi
    exit 0
  fi
done

echo "Could not resolve Next.js app root. Expected web/ or repo root to contain package.json and next.config.*." >&2
exit 1
