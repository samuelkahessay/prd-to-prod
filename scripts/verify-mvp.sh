#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
KNOWN_GOOD_AUDIT_COMMIT="ff2f18746416dfb8ae8bfe1e414e031983a5fb73"

usage() {
  cat >&2 <<'USAGE'
Usage: verify-mvp.sh [--skip-audit] [--audit-commit <sha>]
USAGE
  exit 2
}

SKIP_AUDIT=false
AUDIT_COMMIT="$KNOWN_GOOD_AUDIT_COMMIT"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-audit)
      SKIP_AUDIT=true
      shift
      ;;
    --audit-commit)
      [ "$#" -lt 2 ] && usage
      AUDIT_COMMIT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

CHECKS=(
  "bash scripts/tests/test-ci-failure-context.sh"
  "bash scripts/tests/test-classify-pipeline-issue.sh"
  "bash scripts/tests/test-render-ci-repair-command.sh"
  "bash scripts/tests/test-run-lifecycle-lib.sh"
  "bash scripts/tests/test-self-healing-drill-dispatch-substate.sh"
  "bash scripts/tests/test-self-healing-drill-workflow-matching.sh"
  "dotnet test TicketDeflection.sln"
)

run_check() {
  local check_cmd="$1"

  echo "==> ${check_cmd}"
  if ! (cd "$REPO_ROOT" && eval "$check_cmd"); then
    FAILED_CHECKS+=("$check_cmd")
  fi
}

FAILED_CHECKS=()

for check_cmd in "${CHECKS[@]}"; do
  run_check "$check_cmd"
done

if [ "$SKIP_AUDIT" != "true" ]; then
  run_check "bash scripts/self-healing-drill.sh audit ${AUDIT_COMMIT}"
fi

if [ "${#FAILED_CHECKS[@]}" -gt 0 ]; then
  echo "FAIL (${#FAILED_CHECKS[@]} failed checks)"
  for failed in "${FAILED_CHECKS[@]}"; do
    echo " - ${failed}"
  done
  exit 1
fi

if [ "$SKIP_AUDIT" = "true" ]; then
  echo "PASS (local verification)"
else
  echo "PASS (local verification + audit ${AUDIT_COMMIT})"
fi
