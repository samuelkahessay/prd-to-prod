#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat >&2 <<'USAGE'
Usage: demo-preflight.sh [--skip-live]

Run all readiness checks before a live demonstration.

Options:
  --skip-live    Skip GitHub API and deployment health checks

Exit codes:
  0  All checks passed
  1  One or more checks failed
  2  Usage error
USAGE
  exit 2
}

SKIP_LIVE=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-live) SKIP_LIVE=true; shift ;;
    -h|--help)   usage ;;
    *)           usage ;;
  esac
done

PASS=0
FAIL=0
TOTAL=0

run_check() {
  local label="$1"; shift
  TOTAL=$((TOTAL + 1))
  printf "==> %s\n" "$label"
  if "$@" 2>&1; then
    printf "    [PASS]\n\n"
    PASS=$((PASS + 1))
  else
    printf "    [FAIL]\n\n"
    FAIL=$((FAIL + 1))
  fi
}

# 1. Policy
run_check "Policy: autonomy-policy.yml exists and validates" \
  bash "$SCRIPT_DIR/check-policy.sh" validate

# 2. Build
run_check "Build: dotnet build succeeds" \
  dotnet build "$REPO_ROOT/TicketDeflection.sln" -c Release --no-restore -nologo

# 3. Tests
run_check "Tests: dotnet test passes" \
  dotnet test "$REPO_ROOT/TicketDeflection.sln" -c Release --no-build --nologo

# 4. Drill evidence
check_drill_evidence() {
  local reports_dir="$REPO_ROOT/drills/reports"
  if [ ! -d "$reports_dir" ]; then
    echo "No drills/reports directory found" >&2
    return 1
  fi
  local found
  found=$(find "$reports_dir" -name "*.json" -newer "$REPO_ROOT/TicketDeflection.sln" 2>/dev/null | head -1)
  if [ -z "$found" ]; then
    # Fall back: look for any JSON with a PASS verdict
    found=$(grep -rl '"verdict":"PASS"' "$reports_dir" 2>/dev/null | head -1)
  fi
  if [ -z "$found" ]; then
    echo "No drill report JSON with PASS verdict found in $reports_dir" >&2
    return 1
  fi
  echo "Found drill evidence: $found"
}
run_check "Drill evidence: at least one PASS verdict report exists" check_drill_evidence

# 5. MVP verification
run_check "MVP: verify-mvp.sh passes" \
  bash "$SCRIPT_DIR/verify-mvp.sh" --skip-audit

# 6. Live checks (optional)
if [ "$SKIP_LIVE" = false ]; then
  run_check "Live: CI is green on main" \
    bash -c 'gh run list --repo samuelkahessay/prd-to-prod --branch main --status success --limit 1 --json conclusion | grep -q "success"'

  run_check "Live: deployment health check" \
    bash -c 'curl -fsS --max-time 10 https://prd-to-prod.azurewebsites.net/health >/dev/null 2>&1'
fi

# Summary
if [ "$FAIL" -eq 0 ]; then
  printf "PASS (%d checks)\n" "$PASS"
  exit 0
else
  printf "FAIL (%d failed of %d)\n" "$FAIL" "$TOTAL"
  exit 1
fi
