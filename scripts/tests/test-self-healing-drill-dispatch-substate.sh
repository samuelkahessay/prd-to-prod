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

echo "self-healing-drill dispatch substate tests passed"
