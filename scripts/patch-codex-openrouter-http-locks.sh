#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

if [ "$#" -gt 0 ]; then
  WORKFLOWS=("$@")
else
  WORKFLOWS=(
    "$ROOT_DIR/.github/workflows/prd-decomposer.lock.yml"
    "$ROOT_DIR/.github/workflows/repo-assist.lock.yml"
  )
fi

ruby - "${WORKFLOWS[@]}" <<'RUBY'
provider_block = <<'BLOCK'.chomp
          model_provider = "openrouter_http"

          [model_providers.openrouter_http]
          name = "OpenRouter HTTP"
          base_url = "https://openrouter.ai/api/v1"
          env_key = "OPENROUTER_API_KEY"
          wire_api = "responses"
          requires_openai_auth = false
          supports_websockets = false
BLOCK

ARGV.each do |path|
  next unless File.exist?(path)

  content = File.read(path)
  original = content.dup

  content.gsub!(/\s+--enable-api-proxy\b/, "")
  content.gsub!(/\s+--openai-api-target openrouter\.ai\b/, "")
  content.gsub!(/^ {10}OPENAI_BASE_URL: https:\/\/openrouter\.ai\/api\/v1\n/, "")
  content.gsub!(/^ {10}CODEX_API_KEY: \$\{\{ secrets\.CODEX_API_KEY \|\| secrets\.OPENAI_API_KEY \}\}\n/, "")
  content.gsub!(/^ {10}OPENAI_API_KEY: \$\{\{ secrets\.CODEX_API_KEY \|\| secrets\.OPENAI_API_KEY \}\}\n/, "")
  content.gsub!(/^ {10}OPENROUTER_API_KEY: \$\{\{ secrets\.CODEX_API_KEY \|\| secrets\.OPENAI_API_KEY \}\}\n/, "")
  content.gsub!(/^ {10}GH_AW_MODEL_PROVIDER_AGENT_CODEX: openrouter_http(?:\n|\z)/, "")
  content.gsub!(/^ {10}GH_AW_MODEL_PROVIDER_DETECTION_CODEX: openrouter_http(?:\n|\z)/, "")
  content.gsub!(/env_key = "OPENAI_API_KEY"/, 'env_key = "OPENROUTER_API_KEY"')

  content.gsub!(/--allow-domains "([^"]+)"/) do |match|
    domains = Regexp.last_match(1).split(",")
    unless domains.include?("openrouter.ai")
      domains << "openrouter.ai"
    end
    %(--allow-domains "#{domains.join(",")}")
  end

  unless content.include?(%(model_provider = "openrouter_http"))
    marker = <<'MARKER'
          [history]
          persistence = "none"
MARKER
    replacement = <<REPLACEMENT
#{marker}
          
#{provider_block}
REPLACEMENT
    raise "Could not insert OpenRouter HTTP provider block in #{path}" unless content.sub!(marker, replacement)
  end

  content.gsub!(
    /include_only = \[(.*?)\]/m
  ) do
    entries = Regexp.last_match(1).split(",").map { |entry| entry.strip.delete_prefix('"').delete_suffix('"') }
    entries << "OPENROUTER_API_KEY" unless entries.include?("OPENROUTER_API_KEY")
    %(include_only = [#{entries.map { |entry| %("#{entry}") }.join(", ")}])
  end

  content.gsub!(
    'codex ${GH_AW_MODEL_AGENT_CODEX:+-c model="$GH_AW_MODEL_AGENT_CODEX" }exec',
    'codex ${GH_AW_MODEL_AGENT_CODEX:+-c model="$GH_AW_MODEL_AGENT_CODEX" }${GH_AW_MODEL_PROVIDER_AGENT_CODEX:+-c model_provider="$GH_AW_MODEL_PROVIDER_AGENT_CODEX" }exec'
  )
  content.gsub!(
    'codex ${GH_AW_MODEL_DETECTION_CODEX:+-c model="$GH_AW_MODEL_DETECTION_CODEX" }exec',
    'codex ${GH_AW_MODEL_DETECTION_CODEX:+-c model="$GH_AW_MODEL_DETECTION_CODEX" }${GH_AW_MODEL_PROVIDER_DETECTION_CODEX:+-c model_provider="$GH_AW_MODEL_PROVIDER_DETECTION_CODEX" }exec'
  )

  content.gsub!(
    /^ {10}GH_AW_MODEL_AGENT_CODEX: [^\n]+\n/,
    "\\0          GH_AW_MODEL_PROVIDER_AGENT_CODEX: openrouter_http\n"
  )

  content.gsub!(
    /^ {10}GH_AW_MODEL_DETECTION_CODEX: [^\n]+\n/,
    "\\0          GH_AW_MODEL_PROVIDER_DETECTION_CODEX: openrouter_http\n"
  )

  content.gsub!(
    /^ {10}RUST_LOG: [^\n]+\n/,
    "          OPENROUTER_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}\n\\0"
  )

  content.gsub!(
    "GH_AW_SECRET_NAMES: 'CODEX_API_KEY,GH_AW_GITHUB_MCP_SERVER_TOKEN,GH_AW_GITHUB_TOKEN,GITHUB_TOKEN,OPENAI_API_KEY'",
    "GH_AW_SECRET_NAMES: 'CODEX_API_KEY,GH_AW_GITHUB_MCP_SERVER_TOKEN,GH_AW_GITHUB_TOKEN,GITHUB_TOKEN,OPENAI_API_KEY,OPENROUTER_API_KEY'"
  )
  content.gsub!(
    /^ {10}SECRET_OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}$/m,
    "\\0\n          SECRET_OPENROUTER_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}"
  ) unless content.include?('SECRET_OPENROUTER_API_KEY: ${{ secrets.CODEX_API_KEY || secrets.OPENAI_API_KEY }}')

  unless content.include?(%(supports_websockets = false))
    raise "OpenRouter HTTP provider block missing supports_websockets=false in #{path}"
  end
  unless content.include?(%(env_key = "OPENROUTER_API_KEY"))
    raise "OpenRouter HTTP provider block missing env_key=OPENROUTER_API_KEY in #{path}"
  end
  unless content.include?(%(model_provider="$GH_AW_MODEL_PROVIDER_AGENT_CODEX"))
    raise "Agent codex invocation missing model_provider override in #{path}"
  end
  if content.include?("--enable-api-proxy") || content.include?("--openai-api-target openrouter.ai")
    raise "API proxy flags still present in #{path}"
  end
  if content.include?("OPENAI_BASE_URL: https://openrouter.ai/api/v1")
    raise "OPENAI_BASE_URL env still present in #{path}"
  end

  File.write(path, content) if content != original
end
RUBY

for workflow in "${WORKFLOWS[@]}"; do
  [ -f "$workflow" ] || continue
  echo "codex OpenRouter HTTP lock patch verified: $workflow"
done
