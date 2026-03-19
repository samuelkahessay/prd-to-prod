#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/pr-review-agent.lock.yml"

grep -F "if: >" "$WORKFLOW" >/dev/null
grep -F "(needs.pre_activation.outputs.activated == 'true') && ((github.event_name != 'pull_request') || (github.event.pull_request.head.repo.id == github.repository_id))" "$WORKFLOW" >/dev/null
grep -F "if: (github.event_name != 'pull_request') || (github.event.pull_request.head.repo.id == github.repository_id)" "$WORKFLOW" >/dev/null
grep -F "activated: \${{ steps.activate_pull_request.outputs.activated == 'true' || steps.check_membership.outputs.is_team_member == 'true' }}" "$WORKFLOW" >/dev/null
grep -F "      - name: Check team membership for workflow" "$WORKFLOW" >/dev/null

echo "pr-review-agent.lock.yml activation tests passed"
