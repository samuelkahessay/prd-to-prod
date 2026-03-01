#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/render-ci-repair-command.sh"

OUTPUT=$(
  "$SCRIPT" \
    --pr-number 173 \
    --linked-issue 172 \
    --head-sha fb3f6fc1e3e91007b1c43871187b709214ad83cc \
    --head-branch repo-assist/issue-172-fix-knowledge-article-createdat-65fb9152408a7630 \
    --failure-run-id 22510586524 \
    --failure-run-url https://github.com/samuelkahessay/prd-to-prod/actions/runs/22510586524 \
    --failure-type build \
    --failure-signature cs0117-knowledgearticle-createdat \
    --attempt-count 1 \
    --failure-summary "error CS0117: 'KnowledgeArticle' does not contain a definition for 'CreatedAt'" \
    --failure-excerpt "build-and-test Run dotnet build ... error CS0117"
)

printf '%s' "$OUTPUT" | grep -q '^/repo-assist Repair CI failure for PR #173\.$'
printf '%s' "$OUTPUT" | grep -q '^<!-- ci-repair-command:v1$'
printf '%s' "$OUTPUT" | grep -q '^pr_number=173$'
printf '%s' "$OUTPUT" | grep -q '^linked_issue=172$'
printf '%s' "$OUTPUT" | grep -q '^failure_signature=cs0117-knowledgearticle-createdat$'
printf '%s' "$OUTPUT" | grep -q '^### Failure Summary$'
printf '%s' "$OUTPUT" | grep -q '^```text$'
printf '%s' "$OUTPUT" | grep -q 'build-and-test Run dotnet build \.\.\. error CS0117'

echo "render-ci-repair-command.sh tests passed"
