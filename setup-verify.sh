#!/usr/bin/env bash
set -uo pipefail

###############################################################################
# setup-verify.sh — Validates that the pipeline configuration is complete
#
# Run after setup.sh to verify all components are configured correctly.
# Exit 0 if all checks pass, exit 1 if any fail.
###############################################################################

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Color helpers (disabled when stdout is not a terminal)
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  GREEN='' YELLOW='' RED='' BOLD='' NC=''
fi

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------
PASSED=0
FAILED=0
SKIPPED=0

# ---------------------------------------------------------------------------
# Check helpers
# ---------------------------------------------------------------------------
pass() {
  printf "  ${GREEN}✓${NC} %s\n" "$1"
  (( PASSED++ ))
}

fail() {
  printf "  ${RED}✗${NC} %s\n" "$1"
  (( FAILED++ ))
}

skip() {
  printf "  ${YELLOW}○${NC} %s\n" "$1"
  (( SKIPPED++ ))
}

header() {
  printf "\n${BOLD}%s${NC}\n" "$1"
}

# ---------------------------------------------------------------------------
# Track whether gh auth is available (gates API/remote checks)
# ---------------------------------------------------------------------------
GH_AUTH_OK=false

###############################################################################
# Section 1: Prerequisites
###############################################################################
header "Prerequisites"

if command -v gh >/dev/null 2>&1; then
  pass "gh CLI installed"
else
  fail "gh CLI not installed (https://cli.github.com/)"
fi

if gh aw version >/dev/null 2>&1; then
  pass "gh-aw extension installed"
else
  fail "gh-aw extension not installed (gh extension install github/gh-aw)"
fi

if gh auth status >/dev/null 2>&1; then
  pass "gh authenticated"
  GH_AUTH_OK=true
else
  fail "gh not authenticated (run: gh auth login)"
fi

###############################################################################
# Section 2: Config Files
###############################################################################
header "Config Files"

DEPLOY_PROFILE="$REPO_ROOT/.deploy-profile"
if [[ -f "$DEPLOY_PROFILE" ]]; then
  PROFILE_VALUE=$(cat "$DEPLOY_PROFILE" | tr -d '[:space:]')
  PROFILE_YAML="$REPO_ROOT/.github/deploy-profiles/${PROFILE_VALUE}.yml"
  if [[ -f "$PROFILE_YAML" ]]; then
    pass ".deploy-profile exists (active profile: '$PROFILE_VALUE')"
  else
    fail ".deploy-profile value is '$PROFILE_VALUE' but .github/deploy-profiles/${PROFILE_VALUE}.yml not found"
  fi
else
  fail ".deploy-profile not found"
fi

POLICY_FILE="$REPO_ROOT/autonomy-policy.yml"
if [[ -f "$POLICY_FILE" ]]; then
  if grep -q "# Replace with your" "$POLICY_FILE"; then
    fail "autonomy-policy.yml contains placeholder comments (grep '# Replace with your')"
  else
    pass "autonomy-policy.yml exists with no placeholder comments"
  fi
else
  fail "autonomy-policy.yml not found"
fi

###############################################################################
# Section 3: Compiled Workflows
###############################################################################
header "Compiled Workflows"

WORKFLOWS_DIR="$REPO_ROOT/.github/workflows"
EXPECTED_AGENTS=(repo-assist pr-review-agent prd-decomposer pipeline-status ci-doctor code-simplifier)

for agent in "${EXPECTED_AGENTS[@]}"; do
  if [[ -f "$WORKFLOWS_DIR/${agent}.lock.yml" ]]; then
    pass "${agent}.lock.yml exists"
  else
    fail "${agent}.lock.yml missing (run: gh aw compile)"
  fi
done

###############################################################################
# Section 4: Labels
###############################################################################
header "Labels"

REQUIRED_LABELS=(pipeline feature bug automation in-progress ci-failure repair-in-progress repair-escalated)

if [[ "$GH_AUTH_OK" == true ]]; then
  # Fetch all labels once
  REPO_LABELS=$(gh label list --limit 100 --json name -q '.[].name' 2>/dev/null || echo "")
  if [[ -n "$REPO_LABELS" ]]; then
    for label in "${REQUIRED_LABELS[@]}"; do
      if echo "$REPO_LABELS" | grep -qx "$label"; then
        pass "Label '$label' exists"
      else
        fail "Label '$label' missing (run: ./scripts/bootstrap.sh)"
      fi
    done
  else
    skip "Could not fetch labels (API error or no labels)"
  fi
else
  for label in "${REQUIRED_LABELS[@]}"; do
    skip "Label '$label' (gh auth required)"
  done
fi

###############################################################################
# Section 5: Pipeline Auth and Secrets
###############################################################################
header "Pipeline Auth and Secrets"

if [[ "$GH_AUTH_OK" == true ]]; then
  SECRET_LIST=$(gh secret list --json name -q '.[].name' 2>/dev/null || echo "")
  VAR_LIST=$(gh variable list --json name -q '.[].name' 2>/dev/null || echo "")

  # Check pipeline auth: App OR PAT
  APP_ID_SET=false
  APP_KEY_SET=false
  PAT_SET=false

  if echo "$VAR_LIST" | grep -qx "PIPELINE_APP_ID" 2>/dev/null; then
    pass "Variable 'PIPELINE_APP_ID' is set"
    APP_ID_SET=true
  fi

  if echo "$SECRET_LIST" | grep -qx "PIPELINE_APP_PRIVATE_KEY" 2>/dev/null; then
    pass "Secret 'PIPELINE_APP_PRIVATE_KEY' is set"
    APP_KEY_SET=true
  fi

  if echo "$SECRET_LIST" | grep -qx "GH_AW_GITHUB_TOKEN" 2>/dev/null; then
    pass "Secret 'GH_AW_GITHUB_TOKEN' is set"
    PAT_SET=true
  fi

  if [[ "$APP_ID_SET" == true && "$APP_KEY_SET" == true ]]; then
    pass "Pipeline auth: GitHub App configured"
  elif [[ "$PAT_SET" == true ]]; then
    pass "Pipeline auth: PAT configured"
  else
    fail "Pipeline auth: need GitHub App (PIPELINE_APP_ID + PIPELINE_APP_PRIVATE_KEY) or PAT (GH_AW_GITHUB_TOKEN)"
  fi

  # Check Vercel secrets (only if the active profile declares them)
  if [[ -f "${PROFILE_YAML:-}" ]] && grep -q "VERCEL_TOKEN" "$PROFILE_YAML"; then
    for secret in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
      if echo "$SECRET_LIST" | grep -qx "$secret" 2>/dev/null; then
        pass "Secret '$secret' is set"
      else
        fail "Secret '$secret' not found (run: gh secret set $secret)"
      fi
    done
  else
    skip "Deploy secrets check skipped — configure for your active profile: ${PROFILE_VALUE}"
  fi
else
  skip "Pipeline auth check (gh auth required)"
  for secret in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
    skip "Secret '$secret' (gh auth required)"
  done
fi

###############################################################################
# Section 6: Repo Settings
###############################################################################
header "Repo Settings"

if [[ "$GH_AUTH_OK" == true ]]; then
  AUTO_MERGE=$(gh api repos/:owner/:repo --jq '.allow_auto_merge' 2>/dev/null || echo "")
  if [[ "$AUTO_MERGE" == "true" ]]; then
    pass "Auto-merge is enabled"
  elif [[ -z "$AUTO_MERGE" ]]; then
    skip "Could not check auto-merge setting (API error)"
  else
    fail "Auto-merge is not enabled (run: ./scripts/bootstrap.sh)"
  fi
else
  skip "Auto-merge setting (gh auth required)"
fi

# Check memory/repo-assist branch (uses git, no gh auth required)
if git ls-remote --heads origin memory/repo-assist 2>/dev/null | grep -q memory/repo-assist; then
  pass "memory/repo-assist branch exists"
else
  fail "memory/repo-assist branch not found (run: ./scripts/bootstrap.sh)"
fi

###############################################################################
# Summary
###############################################################################
TOTAL=$(( PASSED + FAILED + SKIPPED ))

printf "\n${BOLD}Summary${NC}\n"
printf "  ${GREEN}%d passed${NC}, ${RED}%d failed${NC}, ${YELLOW}%d skipped${NC} (out of %d checks)\n\n" \
  "$PASSED" "$FAILED" "$SKIPPED" "$TOTAL"

if [[ "$FAILED" -gt 0 ]]; then
  printf "  Configuration incomplete. Run ${BOLD}./setup.sh${NC} to fix missing items.\n\n"
  exit 1
else
  printf "  Configuration complete! Your pipeline is ready.\n\n"
  exit 0
fi
