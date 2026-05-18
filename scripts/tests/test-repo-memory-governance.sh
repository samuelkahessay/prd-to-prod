#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/repo-memory-governance.sh"
REPO_ASSIST="$ROOT_DIR/.github/workflows/repo-assist.md"
ARCH="$ROOT_DIR/docs/ARCHITECTURE.md"
MANIFEST="$ROOT_DIR/scaffold/template-manifest.yml"

[ -x "$SCRIPT" ] || {
  echo "FAIL: scripts/repo-memory-governance.sh must exist and be executable" >&2
  exit 1
}

for word in inspect prune reset --apply; do
  grep -F -- "$word" "$SCRIPT" >/dev/null || {
    echo "FAIL: repo-memory-governance.sh must document/support $word" >&2
    exit 1
  }
done

grep -F "Memory Governance" "$REPO_ASSIST" >/dev/null || {
  echo "FAIL: repo-assist.md must include a Memory Governance section" >&2
  exit 1
}

grep -F "scripts/repo-memory-governance.sh inspect" "$REPO_ASSIST" >/dev/null || {
  echo "FAIL: repo-assist.md must expose the repo-memory inspect path" >&2
  exit 1
}

grep -F "Memory is advisory" "$ARCH" >/dev/null || {
  echo "FAIL: architecture docs must state that memory is advisory" >&2
  exit 1
}

grep -F "scripts/repo-memory-governance.sh" "$MANIFEST" >/dev/null || {
  echo "FAIL: scaffold manifest must export repo-memory governance script" >&2
  exit 1
}

echo "repo-memory governance tests passed"
