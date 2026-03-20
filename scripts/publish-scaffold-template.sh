#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[publish-scaffold-template] $*"
}

fail() {
  echo "[publish-scaffold-template] ERROR: $*" >&2
  exit 1
}

require_env() {
  local name=$1
  if [ -z "${!name:-}" ]; then
    fail "Required environment variable is not set: $name"
  fi
}

SOURCE_DIR="${1:-}"
[ -n "$SOURCE_DIR" ] || fail "Usage: publish-scaffold-template.sh <source-dir>"
[ -d "$SOURCE_DIR" ] || fail "Source directory not found: $SOURCE_DIR"

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
[ -f "$SOURCE_DIR/.github/workflows/auto-dispatch.yml" ] || \
  fail "Source directory does not look like an exported scaffold: $SOURCE_DIR"

TARGET_REPO_DIR="${TARGET_REPO_DIR:-}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
PUSH_CHANGES="${PUSH_CHANGES:-}"
SOURCE_REPOSITORY="${SOURCE_REPOSITORY:-${GITHUB_REPOSITORY:-prd-to-prod}}"
SOURCE_SHA="${SOURCE_SHA:-unknown}"

TMPDIR=""
cleanup() {
  if [ -n "$TMPDIR" ]; then
    rm -rf "$TMPDIR"
  fi
}
trap cleanup EXIT

prepare_target_repo() {
  if [ -n "$TARGET_REPO_DIR" ]; then
    TARGET_REPO_DIR="$(cd "$TARGET_REPO_DIR" && pwd)"
    [ -d "$TARGET_REPO_DIR/.git" ] || fail "TARGET_REPO_DIR must be a git repository: $TARGET_REPO_DIR"
    if [ -z "$PUSH_CHANGES" ]; then
      PUSH_CHANGES=false
    fi
    return
  fi

  require_env TEMPLATE_OWNER
  require_env TEMPLATE_REPO
  require_env GH_AW_GITHUB_TOKEN

  TMPDIR="$(mktemp -d)"
  TARGET_REPO_DIR="$TMPDIR/template-repo"

  git clone --quiet \
    "https://x-access-token:${GH_AW_GITHUB_TOKEN}@github.com/${TEMPLATE_OWNER}/${TEMPLATE_REPO}.git" \
    "$TARGET_REPO_DIR"

  if git -C "$TARGET_REPO_DIR" show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    git -C "$TARGET_REPO_DIR" checkout --quiet -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
  fi

  if [ -z "$PUSH_CHANGES" ]; then
    PUSH_CHANGES=true
  fi
}

prepare_target_repo
: "${PUSH_CHANGES:=false}"

log "Mirroring $SOURCE_DIR into $TARGET_REPO_DIR"

find "$TARGET_REPO_DIR" -mindepth 1 -maxdepth 1 ! -name ".git" -exec rm -rf {} +
cp -R "$SOURCE_DIR"/. "$TARGET_REPO_DIR"/

if [ -z "$(git -C "$TARGET_REPO_DIR" status --short)" ]; then
  log "No template changes to publish"
  echo "PUBLISHED_CHANGES=false"
  exit 0
fi

git -C "$TARGET_REPO_DIR" config user.name "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git -C "$TARGET_REPO_DIR" config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git -C "$TARGET_REPO_DIR" add -A

COMMIT_MESSAGE="chore: sync scaffold from ${SOURCE_REPOSITORY}@${SOURCE_SHA}"
git -C "$TARGET_REPO_DIR" commit --quiet -m "$COMMIT_MESSAGE"

if [ "$PUSH_CHANGES" = "true" ]; then
  PUSH_BRANCH="$TARGET_BRANCH"
  if [ -z "$PUSH_BRANCH" ]; then
    PUSH_BRANCH="$(git -C "$TARGET_REPO_DIR" rev-parse --abbrev-ref HEAD)"
  fi
  git -C "$TARGET_REPO_DIR" push --quiet origin "HEAD:${PUSH_BRANCH}"
  log "Published generated template to ${TEMPLATE_OWNER}/${TEMPLATE_REPO}@${PUSH_BRANCH}"
else
  log "Mirrored scaffold into local checkout without pushing"
fi

echo "PUBLISHED_CHANGES=true"
echo "TARGET_REPO_DIR=$TARGET_REPO_DIR"
