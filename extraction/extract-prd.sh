#!/usr/bin/env bash
set -euo pipefail

# Resolve project root (parent of extraction/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source ~/.env and auto-export all vars so child processes (push-to-pipeline.sh) inherit them
if [ -f "$HOME/.env" ]; then
  set -a
  source "$HOME/.env"
  set +a
fi

[ -f "$SCRIPT_DIR/prompt.md" ] || { echo "FAIL: Prompt template not found: $SCRIPT_DIR/prompt.md" >&2; exit 1; }
[ -n "${OPENROUTER_API_KEY:-}" ] || { echo "FAIL: OPENROUTER_API_KEY required" >&2; exit 1; }

echo "=== prd-to-prod extraction ==="
echo ""

# This extractor currently targets the Vercel bootstrap shape only.
REQUESTED_DEPLOY_PLATFORM="${DEPLOY_PLATFORM:-Vercel}"
if [ "$REQUESTED_DEPLOY_PLATFORM" != "Vercel" ]; then
  echo "ERROR: DEPLOY_PLATFORM=$REQUESTED_DEPLOY_PLATFORM is not supported. meeting-to-main currently targets Vercel only." >&2
  exit 1
fi
DEPLOY_PLATFORM="Vercel"
ALLOWED_STACKS="${ALLOWED_STACKS:-"- Node.js + TypeScript + Express (API routes or standalone server)
- Node.js + TypeScript + Next.js (full-stack with React)
- Node.js + TypeScript + Hono (lightweight API)
- Testing: Vitest
- Storage: In-memory, SQLite, or Postgres (via Prisma)"}"

export DEPLOY_PLATFORM ALLOWED_STACKS

resolve_meeting_input() {
  local raw_arg="${1:-}"
  local stdin_content=""

  if [ "${WORKIQ_LIVE:-}" = "true" ]; then
    WORKIQ_OUTPUT=$(npx tsx "$PROJECT_ROOT/extraction/workiq-client.ts" "${raw_arg:-Product Sync}")
    INPUT_SOURCE="live WorkIQ MCP"
    return 0
  fi

  if [ -n "$raw_arg" ] && [ -f "$raw_arg" ]; then
    WORKIQ_OUTPUT=$(cat "$raw_arg")
    INPUT_SOURCE="provided notes file"
    return 0
  fi

  if [ -n "$raw_arg" ]; then
    WORKIQ_OUTPUT="$raw_arg"
    INPUT_SOURCE="provided notes blurb"
    return 0
  fi

  if [ ! -t 0 ]; then
    stdin_content=$(cat)
    if [ -n "${stdin_content//[$'\t\r\n ']}" ]; then
      WORKIQ_OUTPUT="$stdin_content"
      INPUT_SOURCE="stdin notes"
      return 0
    fi
  fi

  if [ -f "$PROJECT_ROOT/mocks/workiq-response.txt" ]; then
    WORKIQ_OUTPUT=$(cat "$PROJECT_ROOT/mocks/workiq-response.txt")
    INPUT_SOURCE="mock WorkIQ data"
    return 0
  fi

  echo "FAIL: No meeting input provided. Pass a notes file, pipe raw text to stdin, provide an inline blurb, or set WORKIQ_LIVE=true." >&2
  exit 1
}

# Step 1: Meeting input collection
# Supported modes:
#   WORKIQ_LIVE=true ./extraction/extract-prd.sh "meeting query"
#   ./extraction/extract-prd.sh notes.txt
#   ./extraction/extract-prd.sh "Build a lightweight incident dashboard ..."
#   printf 'notes...' | ./extraction/extract-prd.sh
echo "[1/3] Collecting meeting input..."
resolve_meeting_input "${1:-}"
echo "      Using $INPUT_SOURCE"

# Step 2: PRD extraction via LLM
echo "[2/3] Extracting PRD from meeting transcript..."

# Assemble prompt safely using python to avoid bash expansion issues with $, \, etc.
FULL_PROMPT=$(python3 -c "
import sys, os
prompt = open('$PROJECT_ROOT/extraction/prompt.md').read()
workiq = sys.stdin.read()
prompt = prompt.replace('{deploy_platform}', os.environ.get('DEPLOY_PLATFORM', 'Vercel'))
prompt = prompt.replace('{allowed_stacks}', os.environ.get('ALLOWED_STACKS', 'Node.js + TypeScript'))
prompt = prompt.replace('{workiq_output}', workiq)
print(prompt)
" <<< "$WORKIQ_OUTPUT")

# Use OpenRouter API (Claude Sonnet 4.6) instead of claude CLI to avoid nesting issues
ESCAPED_PROMPT=$(printf '%s' "$FULL_PROMPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
API_RESPONSE=$(curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"anthropic/claude-sonnet-4-6\",
    \"messages\": [{\"role\": \"user\", \"content\": $ESCAPED_PROMPT}]
  }")

printf '%s' "$API_RESPONSE" | python3 -c 'import sys,json; print(json.loads(sys.stdin.read())["choices"][0]["message"]["content"])' > "$PROJECT_ROOT/generated-prd.md"
echo "      PRD written to generated-prd.md"

# Validate
source "$PROJECT_ROOT/extraction/validate.sh"
if ! validate_prd "$PROJECT_ROOT/generated-prd.md"; then
  echo ""
  echo "ERROR: Generated PRD failed validation. Check generated-prd.md and retry."
  exit 1
fi
echo "      PRD validation passed"

# Step 3: Trigger pipeline
echo "[3/3] Creating pipeline repo and triggering /decompose..."
bash "$PROJECT_ROOT/trigger/push-to-pipeline.sh" "$PROJECT_ROOT/generated-prd.md"

echo ""
echo "=== Done. Watch the new repo for pipeline activity. ==="
