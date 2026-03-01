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

# Without --pr-diff, no PR Diff section should appear
if printf '%s' "$OUTPUT" | grep -q '^### PR Diff$'; then
  echo "FAIL: PR Diff section should not appear without --pr-diff" >&2
  exit 1
fi

# With --pr-diff, the diff section should appear
OUTPUT_WITH_DIFF=$(
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
    --failure-excerpt "build-and-test Run dotnet build ... error CS0117" \
    --pr-diff "diff --git a/Foo.cs b/Foo.cs
--- a/Foo.cs
+++ b/Foo.cs
@@ -1,3 +1,3 @@
-old line
+new line"
)

printf '%s' "$OUTPUT_WITH_DIFF" | grep -q '^### PR Diff$'
printf '%s' "$OUTPUT_WITH_DIFF" | grep -q '^```diff$'
printf '%s' "$OUTPUT_WITH_DIFF" | grep -q 'diff --git a/Foo.cs b/Foo.cs'

echo "render-ci-repair-command.sh tests passed"
