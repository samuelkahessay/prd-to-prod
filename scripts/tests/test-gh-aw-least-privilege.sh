#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
ERRORS=0

if rg -n 'allowed-repos:[[:space:]]*all' "$ROOT_DIR/.github/workflows"/*.md >/tmp/gh-aw-allowed-repos.log 2>/dev/null; then
  echo "FAIL: workflow sources must not use allowed-repos: all" >&2
  cat /tmp/gh-aw-allowed-repos.log >&2
  ((ERRORS+=1))
fi

if rg -n 'min-integrity:[[:space:]]*none' "$ROOT_DIR/.github/workflows"/*.md >/tmp/gh-aw-min-integrity.log 2>/dev/null; then
  echo "FAIL: workflow sources must not use min-integrity: none" >&2
  cat /tmp/gh-aw-min-integrity.log >&2
  ((ERRORS+=1))
fi

if rg -n 'toolsets:[[:space:]]*\[all\]' "$ROOT_DIR/.github/workflows"/*.md >/tmp/gh-aw-toolsets.log 2>/dev/null; then
  echo "FAIL: workflow sources must not use broad GitHub MCP toolsets: [all]" >&2
  cat /tmp/gh-aw-toolsets.log >&2
  ((ERRORS+=1))
fi

if rg -n '"min-integrity": "none"' "$ROOT_DIR/.github/workflows/prd-decomposer.lock.yml" "$ROOT_DIR/.github/workflows/repo-assist.lock.yml" >/tmp/gh-aw-lock-integrity.log 2>/dev/null; then
  echo "FAIL: compiled locks must not contain min-integrity none for decomposer/repo-assist" >&2
  cat /tmp/gh-aw-lock-integrity.log >&2
  ((ERRORS+=1))
fi

if rg -n '"repos": "all"' "$ROOT_DIR/.github/workflows/prd-decomposer.lock.yml" "$ROOT_DIR/.github/workflows/repo-assist.lock.yml" "$ROOT_DIR/.github/workflows/frontend-agent.lock.yml" >/tmp/gh-aw-lock-repos.log 2>/dev/null; then
  echo "FAIL: compiled locks must not allow all repositories for guarded workflows" >&2
  cat /tmp/gh-aw-lock-repos.log >&2
  ((ERRORS+=1))
fi

for lock in prd-decomposer repo-assist frontend-agent; do
  grep -F 'GITHUB_MCP_GUARD_MIN_INTEGRITY' "$ROOT_DIR/.github/workflows/${lock}.lock.yml" >/dev/null || {
    echo "FAIL: ${lock}.lock.yml must use gh-aw automatic integrity lockdown" >&2
    ((ERRORS+=1))
  }
  grep -F 'GITHUB_MCP_GUARD_REPOS' "$ROOT_DIR/.github/workflows/${lock}.lock.yml" >/dev/null || {
    echo "FAIL: ${lock}.lock.yml must use gh-aw automatic repo lockdown" >&2
    ((ERRORS+=1))
  }
done

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS least-privilege violation(s) found" >&2
  exit 1
fi

echo "gh-aw least privilege tests passed"
