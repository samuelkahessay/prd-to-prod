#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # Keep the harness on the same Node runtime used by the console test hook.
  # That avoids better-sqlite3 ABI mismatches when a newer default Node is first on PATH.
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
fi

node "$ROOT/scripts/e2e/harness.js" "$@"
