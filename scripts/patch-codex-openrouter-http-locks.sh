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
          env_key = "OPENAI_API_KEY"
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

  unless content.include?(%(supports_websockets = false))
    raise "OpenRouter HTTP provider block missing supports_websockets=false in #{path}"
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
