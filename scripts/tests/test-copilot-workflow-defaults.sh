#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

WORKFLOW_SOURCES=$(cd "$ROOT_DIR" && find .github/workflows -maxdepth 1 -name "*.md" -type f | sort)

if printf '%s\n' "$WORKFLOW_SOURCES" | xargs rg -n "engine:|id: codex|OPENAI_BASE_URL|openrouter.ai" >/tmp/copilot-workflow-defaults.log 2>/dev/null; then
  echo "FAIL: gh-aw workflow sources must use the Copilot default, not Codex/OpenRouter frontmatter" >&2
  cat /tmp/copilot-workflow-defaults.log >&2
  exit 1
fi

for file in setup.sh setup-verify.sh scripts/bootstrap.sh README.md README.template.md docs/ARCHITECTURE.md trigger/push-to-pipeline.sh; do
  grep -F "COPILOT_GITHUB_TOKEN" "$ROOT_DIR/$file" >/dev/null || {
    echo "FAIL: $file must document or enforce COPILOT_GITHUB_TOKEN" >&2
    exit 1
  }
done

for file in setup.sh scripts/bootstrap.sh; do
  if grep -F "gh aw secrets bootstrap" "$ROOT_DIR/$file" >/dev/null; then
    echo "FAIL: $file still presents gh-aw interactive secrets bootstrap as the default engine setup" >&2
    exit 1
  fi
done

for file in scripts/bootstrap.sh scaffold/export-scaffold.sh scaffold/bootstrap-test.sh scripts/verify-mvp.sh .github/workflows/ci-scripts.yml; do
  if rg -n "patch-codex-openrouter-http-locks|patch-pr-review-agent-lock" "$ROOT_DIR/$file" >/dev/null; then
    echo "FAIL: $file still depends on legacy Codex/OpenRouter lock patching" >&2
    exit 1
  fi
done

grep -F "github/gh-aw-actions/setup-cli@v0.72.1" "$ROOT_DIR/.github/workflows/publish-scaffold-template.yml" >/dev/null || {
  echo "FAIL: publish workflow must install gh-aw v0.72.1" >&2
  exit 1
}

echo "copilot workflow default tests passed"
