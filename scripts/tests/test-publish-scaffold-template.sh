#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/publish-scaffold-template.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

SOURCE_DIR="$TMPDIR/source"
TARGET_REPO_DIR="$TMPDIR/template-repo"

mkdir -p "$SOURCE_DIR/.github/workflows" "$SOURCE_DIR/scripts"
printf 'name: auto-dispatch\n' > "$SOURCE_DIR/.github/workflows/auto-dispatch.yml"
printf 'name: repo-assist\n' > "$SOURCE_DIR/.github/workflows/repo-assist.lock.yml"
printf 'nextjs-vercel\n' > "$SOURCE_DIR/.deploy-profile"
printf '# Template README\n' > "$SOURCE_DIR/README.md"
printf '#!/usr/bin/env bash\necho bootstrap\n' > "$SOURCE_DIR/scripts/bootstrap.sh"
chmod +x "$SOURCE_DIR/scripts/bootstrap.sh"

mkdir -p "$TARGET_REPO_DIR"
(
  cd "$TARGET_REPO_DIR"
  git init -q
  git checkout -q -b main
  git config user.name "Codex Test"
  git config user.email "codex-test@example.com"
  printf 'old\n' > obsolete.txt
  printf '# stale\n' > README.md
  git add -A
  git commit -q -m "initial"
)

OUTPUT="$TMPDIR/output.log"
TARGET_REPO_DIR="$TARGET_REPO_DIR" \
SOURCE_REPOSITORY="samuelkahessay/prd-to-prod" \
SOURCE_SHA="abc123" \
bash "$SCRIPT" "$SOURCE_DIR" > "$OUTPUT"

if [ -f "$TARGET_REPO_DIR/obsolete.txt" ]; then
  echo "FAIL: Test 1: obsolete file was not deleted" >&2
  exit 1
fi

if [ ! -f "$TARGET_REPO_DIR/.github/workflows/auto-dispatch.yml" ]; then
  echo "FAIL: Test 1: scaffold workflow was not copied" >&2
  exit 1
fi

if [ -n "$(git -C "$TARGET_REPO_DIR" status --short)" ]; then
  echo "FAIL: Test 1: target repo should be clean after sync commit" >&2
  exit 1
fi

if ! git -C "$TARGET_REPO_DIR" log -1 --pretty=%B | grep -q "samuelkahessay/prd-to-prod@abc123"; then
  echo "FAIL: Test 1: sync commit is missing source SHA traceability" >&2
  exit 1
fi
echo "Test 1 passed: scaffold mirrored with exact-match commit"

COMMIT_COUNT_BEFORE=$(git -C "$TARGET_REPO_DIR" rev-list --count HEAD)
TARGET_REPO_DIR="$TARGET_REPO_DIR" \
SOURCE_REPOSITORY="samuelkahessay/prd-to-prod" \
SOURCE_SHA="abc123" \
bash "$SCRIPT" "$SOURCE_DIR" > "$OUTPUT"
COMMIT_COUNT_AFTER=$(git -C "$TARGET_REPO_DIR" rev-list --count HEAD)

if [ "$COMMIT_COUNT_BEFORE" != "$COMMIT_COUNT_AFTER" ]; then
  echo "FAIL: Test 2: unchanged scaffold should not create a new commit" >&2
  exit 1
fi

if ! grep -q "PUBLISHED_CHANGES=false" "$OUTPUT"; then
  echo "FAIL: Test 2: unchanged scaffold should report no publish changes" >&2
  exit 1
fi
echo "Test 2 passed: unchanged scaffold is a no-op"

echo "publish-scaffold-template tests passed"
