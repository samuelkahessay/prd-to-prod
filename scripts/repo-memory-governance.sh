#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  scripts/repo-memory-governance.sh inspect [branch]
  scripts/repo-memory-governance.sh prune [branch] [--apply]
  scripts/repo-memory-governance.sh reset [branch] [--apply]

Defaults:
  branch: memory/repo-assist

Behavior:
  inspect  Summarizes repo-memory files, oversized blobs, and legacy checkpoints.
  prune    Removes legacy checkpoint files and oversized non-state files.
  reset    Replaces the memory branch with a single initialized state.json.

prune/reset are dry-run by default. Pass --apply to push changes.
USAGE
  exit 2
}

ACTION="${1:-}"
[ -n "$ACTION" ] || usage
shift || true

BRANCH="${1:-memory/repo-assist}"
if [ "${1:-}" = "--apply" ]; then
  BRANCH="memory/repo-assist"
else
  [ "$#" -gt 0 ] && shift || true
fi

APPLY=false
if [ "${1:-}" = "--apply" ]; then
  APPLY=true
  shift
fi
[ "$#" -eq 0 ] || usage

case "$ACTION" in
  inspect|prune|reset) ;;
  *) usage ;;
esac

command -v gh >/dev/null 2>&1 || { echo "gh CLI is required" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 2; }

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
REMOTE_URL=$(gh repo view --json url -q '.url')

inspect_branch() {
  local tree_json
  tree_json=$(gh api "repos/${REPO}/git/trees/${BRANCH}?recursive=1" 2>/dev/null || true)
  if [ -z "$tree_json" ] || [ "$(printf '%s' "$tree_json" | jq -r '.truncated // false')" = "null" ]; then
    echo "Repo-memory branch not found or not readable: ${BRANCH}"
    return 1
  fi

  local files oversized legacy
  files=$(printf '%s' "$tree_json" | jq '[.tree[]? | select(.type == "blob")] | length')
  oversized=$(printf '%s' "$tree_json" | jq '[.tree[]? | select(.type == "blob" and (.size // 0) > 10240)] | length')
  legacy=$(printf '%s' "$tree_json" | jq '[.tree[]? | select(.type == "blob" and (.path | split("/")[-1] | startswith("checkpoint:")))] | length')

  echo "Repo-memory branch: ${BRANCH}"
  echo "Files: ${files}"
  echo "Oversized files >10KB: ${oversized}"
  echo "Legacy checkpoint files: ${legacy}"

  if [ "$files" -gt 100 ]; then
    echo "WARN: file count exceeds the 100-file validation budget"
  fi
}

case "$ACTION" in
  inspect)
    inspect_branch
    ;;
  prune|reset)
    TMPDIR=$(mktemp -d)
    cleanup() { rm -rf "$TMPDIR"; }
    trap cleanup EXIT

    git clone --quiet --branch "$BRANCH" "$REMOTE_URL" "$TMPDIR/repo-memory" 2>/dev/null || {
      echo "Repo-memory branch not found: ${BRANCH}" >&2
      exit 1
    }

    if [ "$ACTION" = "reset" ]; then
      find "$TMPDIR/repo-memory" -mindepth 1 -maxdepth 1 ! -name ".git" -exec rm -rf {} +
      printf '{"initialized":true,"reset_by":"repo-memory-governance","branch":"%s"}\n' "$BRANCH" > "$TMPDIR/repo-memory/state.json"
    else
      find "$TMPDIR/repo-memory" -type f -name 'checkpoint:*' -delete
      find "$TMPDIR/repo-memory" -type f -size +10k \
        ! -path '*/state/*' \
        ! -path '*/status/*' \
        -delete
    fi

    if [ -z "$(git -C "$TMPDIR/repo-memory" status --short)" ]; then
      echo "No repo-memory changes needed for ${BRANCH}"
      exit 0
    fi

    git -C "$TMPDIR/repo-memory" status --short
    if [ "$APPLY" != "true" ]; then
      echo "Dry run only. Re-run with --apply to push ${ACTION} changes."
      exit 0
    fi

    git -C "$TMPDIR/repo-memory" config user.name "${GIT_AUTHOR_NAME:-repo-memory-governance}"
    git -C "$TMPDIR/repo-memory" config user.email "${GIT_AUTHOR_EMAIL:-repo-memory-governance@users.noreply.github.com}"
    git -C "$TMPDIR/repo-memory" add -A
    git -C "$TMPDIR/repo-memory" commit --quiet -m "chore: ${ACTION} repo memory"
    git -C "$TMPDIR/repo-memory" push --quiet origin "HEAD:${BRANCH}"
    echo "Repo-memory ${ACTION} pushed to ${BRANCH}"
    ;;
esac
