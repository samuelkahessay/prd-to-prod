#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/self-healing-drill.sh"

SELF_HEALING_DRILL_SOURCE_ONLY=1
. "$SCRIPT"

[ "$(ci_failure_workflow_rank "Deploy Router")" = "0" ]
[ "$(ci_failure_workflow_rank "Deploy to Azure")" = "1" ]
[ "$(ci_failure_workflow_rank ".NET CI")" = "2" ]
[ "$(ci_failure_workflow_rank "Node CI")" = "99" ]

is_ci_failure_workflow_name "Deploy Router"
is_ci_failure_workflow_name "Deploy to Azure"
is_ci_failure_workflow_name ".NET CI"
if is_ci_failure_workflow_name "Node CI"; then
  echo "Node CI should not be treated as a drill failure signal" >&2
  exit 1
fi

is_main_recovery_workflow_name "Deploy Router"
is_main_recovery_workflow_name "Deploy to Azure"
if is_main_recovery_workflow_name ".NET CI"; then
  echo ".NET CI should not be treated as a main recovery signal" >&2
  exit 1
fi

echo "self-healing-drill workflow matching tests passed"
