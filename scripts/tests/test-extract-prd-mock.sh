#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/extraction/extract-prd.sh"

# RED guard
if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet — test defines the contract" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# ── Mock setup ────────────────────────────────────────────────

# Create mock WorkIQ response
cat > "$TMPDIR/workiq-response.txt" <<'MOCK'
Meeting Summary: The team discussed building a new task tracking API.
They want a REST API using Node.js and TypeScript with Express.
Features discussed:
1. Create tasks with title, description, and status
2. List all tasks with filtering
3. Update task status
The API should be deployed to Vercel.
MOCK

# Create mock mocks/ directory structure
mkdir -p "$TMPDIR/mocks"
cp "$TMPDIR/workiq-response.txt" "$TMPDIR/mocks/workiq-response.txt"

# Create a canned PRD that the LLM "returns"
CANNED_PRD=$(cat <<'PRD'
# PRD: Task Tracking API

## Overview
A REST API for tracking tasks, deployed to Vercel.

## Tech Stack
- Runtime: Node.js 20+
- Framework: Express.js
- Language: TypeScript
- Testing: Vitest

## Validation Commands
- Build: npm run build
- Test: npm test

## Features

### Feature 1: Task CRUD
Create, read, update tasks with title, description, and status.

**Acceptance Criteria:**
- [ ] POST /api/tasks creates a task
- [ ] GET /api/tasks lists tasks

## Non-Functional Requirements
- Response time under 200ms

## Out of Scope
- Authentication
PRD
)

# OpenRouter stub — returns canned PRD content
mkdir -p "$TMPDIR/bin"
cat > "$TMPDIR/bin/curl" <<STUB
#!/usr/bin/env bash
# Stub curl: intercept OpenRouter calls, pass through others
if echo "\$*" | grep -q "openrouter.ai"; then
  # Return a properly formatted API response
  CONTENT=\$(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<'PRDCONTENT'
$CANNED_PRD
PRDCONTENT
)
  printf '{"choices":[{"message":{"content":%s}}]}' "\$CONTENT"
else
  /usr/bin/curl "\$@"
fi
STUB
chmod +x "$TMPDIR/bin/curl"

# Stub trigger script (don't actually create repos)
mkdir -p "$TMPDIR/trigger"
cat > "$TMPDIR/trigger/push-to-pipeline.sh" <<'STUB'
#!/usr/bin/env bash
echo "push-to-pipeline.sh called with: $1" >> "$CALL_LOG"
echo "PIPELINE_REPO=test/repo"
STUB
chmod +x "$TMPDIR/trigger/push-to-pipeline.sh"

# ── Test 1: Mock extraction produces valid PRD ────────────────

# We'll run extract-prd.sh with:
# - PATH override so our curl stub intercepts OpenRouter calls
# - WORKIQ_LIVE unset (uses mock)
# - Patched project root pointing to our temp dir

# Copy the extraction scripts to temp dir
mkdir -p "$TMPDIR/extraction"
cp "$ROOT_DIR/extraction/extract-prd.sh" "$TMPDIR/extraction/"
cp "$ROOT_DIR/extraction/validate.sh" "$TMPDIR/extraction/"
cp "$ROOT_DIR/extraction/prompt.md" "$TMPDIR/extraction/"
chmod +x "$TMPDIR/extraction/extract-prd.sh"

CALL_LOG="$TMPDIR/calls.log"
: > "$CALL_LOG"

export OPENROUTER_API_KEY="test-key"
export CALL_LOG
export PATH="$TMPDIR/bin:$PATH"

# Run the extraction
if ! (cd "$TMPDIR" && bash extraction/extract-prd.sh 2>"$TMPDIR/stderr.log"); then
  echo "FAIL: Test 1: extract-prd.sh failed" >&2
  cat "$TMPDIR/stderr.log" >&2
  exit 1
fi

# Verify PRD was generated
if [ ! -f "$TMPDIR/generated-prd.md" ]; then
  echo "FAIL: Test 1: generated-prd.md was not created" >&2
  exit 1
fi

# Verify PRD passes validation
source "$ROOT_DIR/extraction/validate.sh"
if ! validate_prd "$TMPDIR/generated-prd.md"; then
  echo "FAIL: Test 1: generated PRD failed validation" >&2
  exit 1
fi

echo "Test 1 passed: mock extraction produced valid PRD"

# ── Test 2: Trigger was called ────────────────────────────────

if ! grep -q "push-to-pipeline.sh called" "$CALL_LOG"; then
  echo "FAIL: Test 2: push-to-pipeline.sh was not called" >&2
  exit 1
fi
echo "Test 2 passed: trigger was invoked"

# ── Test 3: Missing OPENROUTER_API_KEY fails ──────────────────

# Prevent ~/.env from re-setting the key by using env -u
if (cd "$TMPDIR" && env -u OPENROUTER_API_KEY HOME=/nonexistent bash extraction/extract-prd.sh >/dev/null 2>&1); then
  echo "FAIL: Test 3: should fail without OPENROUTER_API_KEY" >&2
  exit 1
fi
echo "Test 3 passed: missing API key fails fast"

echo "extract-prd-mock tests passed"
