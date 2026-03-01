#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/self-healing-drill.sh"

SELF_HEALING_DRILL_SOURCE_ONLY=1
. "$SCRIPT"

DIRECT=$(derive_dispatch_substate "" "" "" "issue_comment_marker")
DEFERRED=$(derive_dispatch_substate "2026-03-01T19:31:38Z" "" "" "")
REQUEUED_BY_REASON=$(derive_dispatch_substate "2026-03-01T19:31:38Z" "" "requeue_after_guard_skip" "issue_comment_marker")
REQUEUED_BY_ORIGIN=$(derive_dispatch_substate "2026-03-01T19:31:38Z" "Auto-Dispatch Requeue" "" "issue_comment_marker")
HEURISTIC=$(derive_dispatch_substate "" "" "" "heuristic:first_repo_assist_after_issue")

[ "$DIRECT" = "direct" ]
[ "$DEFERRED" = "deferred" ]
[ "$REQUEUED_BY_REASON" = "deferred->requeued" ]
[ "$REQUEUED_BY_ORIGIN" = "deferred->requeued" ]
[ "$HEURISTIC" = "heuristic" ]

is_dispatch_candidate_run "workflow_dispatch" "in_progress" ""
is_dispatch_candidate_run "issue_comment" "completed" "success"
if is_dispatch_candidate_run "issues" "completed" "skipped"; then
  echo "issues/skipped run should not be a dispatch candidate" >&2
  exit 1
fi

if is_dispatch_candidate_run "workflow_dispatch" "completed" "skipped"; then
  echo "skipped workflow_dispatch run should not be a dispatch candidate" >&2
  exit 1
fi

should_wait_for_dispatch_marker 100 120
if should_wait_for_dispatch_marker 100 220; then
  echo "marker grace window should have expired" >&2
  exit 1
fi

echo "self-healing-drill dispatch substate tests passed"
