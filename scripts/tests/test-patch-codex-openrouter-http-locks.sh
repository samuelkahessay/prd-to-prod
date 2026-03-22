#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/patch-codex-openrouter-http-locks.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

WORKFLOW="$TMPDIR/prd-decomposer.lock.yml"

cat > "$WORKFLOW" <<'YAML'
name: test
jobs:
  agent:
    steps:
      - name: Start MCP Gateway
        run: |
          cat > /tmp/gh-aw/mcp-config/config.toml << GH_AW_MCP_CONFIG_EOF
          [history]
          persistence = "none"
          
          [shell_environment_policy]
          inherit = "core"
          include_only = ["OPENAI_API_KEY", "PATH"]
          GH_AW_MCP_CONFIG_EOF
      - name: Execute Codex CLI
        run: |
          sudo -E awf --allow-domains "api.openai.com,openai.com" --enable-api-proxy --openai-api-target openrouter.ai \
            -- /bin/bash -lc 'codex ${GH_AW_MODEL_AGENT_CODEX:+-c model="$GH_AW_MODEL_AGENT_CODEX" }exec test'
        env:
          CODEX_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}
          GH_AW_MODEL_AGENT_CODEX: openai/gpt-5-codex
          OPENAI_BASE_URL: https://openrouter.ai/api/v1
          OPENAI_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}
          RUST_LOG: trace
      - name: Execute Codex CLI
        run: |
          sudo -E awf --allow-domains "host.docker.internal" --enable-api-proxy --openai-api-target openrouter.ai \
            -- /bin/bash -lc 'codex ${GH_AW_MODEL_DETECTION_CODEX:+-c model="$GH_AW_MODEL_DETECTION_CODEX" }exec detect'
        env:
          CODEX_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}
          GH_AW_MODEL_DETECTION_CODEX: openai/gpt-5-codex
          OPENAI_BASE_URL: https://openrouter.ai/api/v1
          OPENAI_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}
          RUST_LOG: trace
YAML

hash_file() {
  ruby -e 'require "digest"; print Digest::SHA256.file(ARGV[0]).hexdigest' "$1"
}

bash "$SCRIPT" "$WORKFLOW" >/dev/null
FIRST_HASH=$(hash_file "$WORKFLOW")

bash "$SCRIPT" "$WORKFLOW" >/dev/null
SECOND_HASH=$(hash_file "$WORKFLOW")

[ "$FIRST_HASH" = "$SECOND_HASH" ]

grep -F 'model_provider = "openrouter_http"' "$WORKFLOW" >/dev/null
grep -F 'supports_websockets = false' "$WORKFLOW" >/dev/null
grep -F 'env_key = "OPENROUTER_API_KEY"' "$WORKFLOW" >/dev/null
grep -F 'model_provider="$GH_AW_MODEL_PROVIDER_AGENT_CODEX"' "$WORKFLOW" >/dev/null
grep -F 'model_provider="$GH_AW_MODEL_PROVIDER_DETECTION_CODEX"' "$WORKFLOW" >/dev/null
grep -F 'GH_AW_MODEL_PROVIDER_AGENT_CODEX: openrouter_http' "$WORKFLOW" >/dev/null
grep -F 'GH_AW_MODEL_PROVIDER_DETECTION_CODEX: openrouter_http' "$WORKFLOW" >/dev/null
grep -F 'OPENROUTER_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}' "$WORKFLOW" >/dev/null

if grep -q -- '--enable-api-proxy' "$WORKFLOW"; then
  echo "FAIL: API proxy flag still present after patch" >&2
  exit 1
fi

if grep -q 'OPENAI_BASE_URL: https://openrouter.ai/api/v1' "$WORKFLOW"; then
  echo "FAIL: OPENAI_BASE_URL env still present after patch" >&2
  exit 1
fi

if grep -q 'CODEX_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}' "$WORKFLOW"; then
  echo "FAIL: CODEX_API_KEY env still present in execute steps after patch" >&2
  exit 1
fi

if grep -q 'OPENAI_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}' "$WORKFLOW"; then
  echo "FAIL: OPENAI_API_KEY env still present in execute steps after patch" >&2
  exit 1
fi

[ "$(grep -c 'openrouter.ai' "$WORKFLOW")" -ge 3 ]
[ "$(grep -c 'supports_websockets = false' "$WORKFLOW")" -eq 1 ]

echo "patch-codex-openrouter-http-locks.sh tests passed"
