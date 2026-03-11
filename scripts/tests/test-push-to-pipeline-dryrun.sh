#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/trigger/push-to-pipeline.sh"

# RED guard
if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

CALL_LOG="$TMPDIR/call.log"
export CALL_LOG

# ── Create test PRD ───────────────────────────────────────────

cat > "$TMPDIR/test-prd.md" <<'PRD'
# PRD: Test Project

## Overview
A test project.

## Tech Stack
- Runtime: Node.js 20+
- Language: TypeScript

## Validation Commands
- Build: npm run build
- Test: npm test

## Features

### Feature 1: Test Feature
A test feature.

**Acceptance Criteria:**
- [ ] It works

## Non-Functional Requirements
- Must be fast

## Out of Scope
- Everything else
PRD

# ── Create scaffold dir ──────────────────────────────────────

mkdir -p "$TMPDIR/dist/scaffold/.github/workflows"
echo "name: auto-dispatch" > "$TMPDIR/dist/scaffold/.github/workflows/auto-dispatch.yml"
echo "name: repo-assist" > "$TMPDIR/dist/scaffold/.github/workflows/repo-assist.lock.yml"
echo "name: pr-review" > "$TMPDIR/dist/scaffold/.github/workflows/pr-review-agent.lock.yml"
echo "name: prd-decomposer" > "$TMPDIR/dist/scaffold/.github/workflows/prd-decomposer.lock.yml"

# ── Stub gh CLI ───────────────────────────────────────────────

mkdir -p "$TMPDIR/bin"
REPO_VIEW_COUNT_FILE="$TMPDIR/repo_view_count"
echo "0" > "$REPO_VIEW_COUNT_FILE"
export REPO_VIEW_COUNT_FILE

cat > "$TMPDIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "gh $*" >> "$CALL_LOG"

case "$1" in
  auth)
    exit 0
    ;;
  aw)
    case "$2" in
      --help) exit 0 ;;
      compile) exit 0 ;;
    esac
    ;;
  repo)
    case "$2" in
      create)
        echo "https://github.com/test/test-project"
        exit 0
        ;;
      view)
        # First call = existence check (should fail = repo doesn't exist yet)
        # Subsequent calls = readiness check (should succeed)
        COUNT=$(cat "$REPO_VIEW_COUNT_FILE")
        COUNT=$((COUNT + 1))
        echo "$COUNT" > "$REPO_VIEW_COUNT_FILE"
        if [ "$COUNT" -eq 1 ]; then
          exit 1  # Repo doesn't exist yet
        fi
        echo '{"name":"test-project","allow_auto_merge":true}'
        exit 0
        ;;
      clone)
        # Create a minimal git repo at the clone destination with lock files
        DEST="${4:-/tmp/clone-$$}"
        mkdir -p "$DEST/.github/workflows"
        echo "name: repo-assist" > "$DEST/.github/workflows/repo-assist.lock.yml"
        echo "name: prd-decomposer" > "$DEST/.github/workflows/prd-decomposer.lock.yml"
        echo "name: pr-review-agent" > "$DEST/.github/workflows/pr-review-agent.lock.yml"
        (cd "$DEST" && git init -q && git add -A && git commit -m "init" -q)
        exit 0
        ;;
    esac
    ;;
  api)
    # Determine the endpoint and any --jq filter
    JQ_FILTER=""
    ENDPOINT=""
    METHOD=""
    skip_next=false
    for arg in "$@"; do
      if $skip_next; then skip_next=false; continue; fi
      case "$arg" in
        --jq) skip_next=true; JQ_FILTER="next" ;;
        --method) skip_next=true ;;
        -f|-F|--input) skip_next=true ;;
        api) continue ;;
        -*) continue ;;
        *) [ -z "$ENDPOINT" ] && ENDPOINT="$arg" ;;
      esac
    done
    # Re-extract --jq value properly
    JQ_FILTER=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --jq) JQ_FILTER="$2"; shift 2 ;;
        *) shift ;;
      esac
    done

    # Build canned JSON based on endpoint
    if echo "$ENDPOINT" | grep -q "actions/permissions/workflow"; then
      JSON='{"default_workflow_permissions":"write","can_approve_pull_request_reviews":true}'
    elif echo "$ENDPOINT" | grep -q "branches/main/protection/required_status_checks"; then
      JSON='{"contexts":["review","Node CI / check-profile","Node CI / build-and-test"]}'
    elif echo "$ENDPOINT" | grep -q "branches/main/protection"; then
      JSON='{"required_pull_request_reviews":{"required_approving_review_count":1},"required_status_checks":{"contexts":["review","Node CI / check-profile","Node CI / build-and-test"]}}'
    elif echo "$ENDPOINT" | grep -q "contents/"; then
      JSON='{"name":"file"}'
    else
      JSON='{"allow_auto_merge":true}'
    fi

    if [ -n "$JQ_FILTER" ]; then
      echo "$JSON" | jq -r "$JQ_FILTER"
    else
      echo "$JSON"
    fi
    exit 0
    ;;
  label)
    exit 0
    ;;
  variable)
    if [ "$2" = "list" ]; then
      JSON='[{"name":"PIPELINE_APP_ID","value":"12345"},{"name":"PIPELINE_BOT_LOGIN","value":"prd-to-prod-pipeline"}]'
      # Handle --jq
      JQ_FILTER=""
      shift 2
      while [ $# -gt 0 ]; do
        case "$1" in
          --jq) JQ_FILTER="$2"; shift 2 ;;
          *) shift ;;
        esac
      done
      if [ -n "$JQ_FILTER" ]; then
        echo "$JSON" | jq -r "$JQ_FILTER"
      else
        echo "$JSON"
      fi
    fi
    exit 0
    ;;
  secret)
    if [ "$2" = "list" ]; then
      JSON='[{"name":"PIPELINE_APP_PRIVATE_KEY"},{"name":"COPILOT_GITHUB_TOKEN"},{"name":"VERCEL_TOKEN"},{"name":"VERCEL_ORG_ID"},{"name":"GH_AW_GITHUB_TOKEN"}]'
      JQ_FILTER=""
      shift 2
      while [ $# -gt 0 ]; do
        case "$1" in
          --jq) JQ_FILTER="$2"; shift 2 ;;
          *) shift ;;
        esac
      done
      if [ -n "$JQ_FILTER" ]; then
        echo "$JSON" | jq -r "$JQ_FILTER"
      else
        echo "$JSON"
      fi
    fi
    exit 0
    ;;
  issue)
    case "$2" in
      create)
        echo "https://github.com/test/test-project/issues/1"
        exit 0
        ;;
      comment)
        exit 0
        ;;
    esac
    ;;
esac
exit 0
STUB
chmod +x "$TMPDIR/bin/gh"

# Stub git to avoid actual git operations in verify functions
cat > "$TMPDIR/bin/git" <<'STUB'
#!/usr/bin/env bash
echo "git $*" >> "$CALL_LOG"
case "$1" in
  -C) shift 2; exec /usr/bin/git "$@" ;;
  *) exec /usr/bin/git "$@" ;;
esac
STUB
chmod +x "$TMPDIR/bin/git"

# Stub jq — use the real one
ln -sf "$(which jq)" "$TMPDIR/bin/jq" 2>/dev/null || true

export PATH="$TMPDIR/bin:$PATH"
export SCAFFOLD_SOURCE_DIR="$TMPDIR/dist/scaffold"
export COPILOT_GITHUB_TOKEN="test-token"
export VERCEL_TOKEN="test-token"
export VERCEL_ORG_ID="test-org"
export PIPELINE_APP_ID="12345"
export PIPELINE_APP_PRIVATE_KEY="test-key"

# ── Test 1: Dry-run produces correct command sequence ─────────

: > "$CALL_LOG"

if ! bash "$SCRIPT" "$TMPDIR/test-prd.md" >"$TMPDIR/stdout.log" 2>"$TMPDIR/stderr.log"; then
  echo "FAIL: Test 1: push-to-pipeline.sh failed" >&2
  cat "$TMPDIR/stderr.log" >&2
  exit 1
fi

# Verify key commands were called
if ! grep -q "gh repo create" "$CALL_LOG"; then
  echo "FAIL: Test 1: expected 'gh repo create' in call log" >&2
  exit 1
fi
echo "Test 1 passed: correct command sequence"

# ── Test 2: Machine-readable exports present ──────────────────

if ! grep -q "PIPELINE_REPO=" "$TMPDIR/stdout.log"; then
  echo "FAIL: Test 2: missing PIPELINE_REPO export" >&2
  exit 1
fi
echo "Test 2 passed: machine-readable exports present"

# ── Test 3: Issue creation called ─────────────────────────────

if ! grep -q "gh issue create" "$CALL_LOG"; then
  echo "FAIL: Test 3: expected 'gh issue create' in call log" >&2
  exit 1
fi
echo "Test 3 passed: issue creation called"

# ── Test 4: No reference to old template repo ────────────────

if grep -qF 'PIPELINE_TEMPLATE:-samuelkahessay/prd-to-prod-template' "$SCRIPT"; then
  echo "FAIL: Test 4: still references old template repo as default" >&2
  exit 1
fi
echo "Test 4 passed: no stale template reference"

echo "push-to-pipeline-dryrun tests passed"
