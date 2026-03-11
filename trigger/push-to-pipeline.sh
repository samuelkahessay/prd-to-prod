#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[prd-to-prod] $*"
}

fail() {
  echo "[prd-to-prod] ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

require_env() {
  local name=$1
  if [ -z "${!name:-}" ]; then
    fail "Required environment variable is not set: $name"
  fi
}

load_env_file() {
  local env_file=$1

  [ -f "$env_file" ] || return 0

  set -a
  # shellcheck source=/dev/null
  . "$env_file"
  set +a
}

normalize_suffix() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//'
}

visibility_flag() {
  case "${1:-public}" in
    public) printf '%s' '--public' ;;
    private) printf '%s' '--private' ;;
    internal) printf '%s' '--internal' ;;
    *) fail "Unsupported PIPELINE_VISIBILITY value: ${1:-}" ;;
  esac
}

verify_actions_permissions() {
  local repo=$1
  local workflow_permissions
  local can_approve

  workflow_permissions=$(gh api "repos/$repo/actions/permissions/workflow" --jq '.default_workflow_permissions')
  can_approve=$(gh api "repos/$repo/actions/permissions/workflow" --jq '.can_approve_pull_request_reviews')

  [ "$workflow_permissions" = "write" ] || fail "Actions workflow permissions are '$workflow_permissions' instead of 'write' for $repo"
  [ "$can_approve" = "true" ] || fail "Actions cannot approve pull request reviews for $repo"
}

verify_repo_variable() {
  local repo=$1
  local name=$2
  local expected=$3
  local actual

  actual=$(gh variable list --repo "$repo" --json name,value --jq ".[] | select(.name == \"$name\") | .value" | head -1 || true)
  [ -n "$actual" ] || fail "Repository variable $name is missing on $repo"
  [ "$actual" = "$expected" ] || fail "Repository variable $name is '$actual' instead of '$expected' on $repo"
}

verify_repo_secret() {
  local repo=$1
  local name=$2

  gh secret list --repo "$repo" --json name --jq ".[] | select(.name == \"$name\") | .name" | grep -qx "$name" || \
    fail "Repository secret $name is missing on $repo"
}

verify_remote_lock_file() {
  local repo=$1
  local path=$2
  gh api "repos/$repo/contents/$path?ref=main" >/dev/null || fail "Compiled lock file missing on remote: $path"
}

json_array_from_csv() {
  printf '%s\n' "${1:-}" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | awk 'NF && !seen[$0]++' | jq -R . | jq -s .
}

configure_branch_protection() {
  local repo=$1
  local required_checks_json

  required_checks_json=$(json_array_from_csv "$PIPELINE_REQUIRED_STATUS_CHECKS")

  gh api "repos/$repo/branches/main/protection" --method PUT \
    --input - >/dev/null <<PROTECTION
{
  "required_status_checks": {
    "strict": false,
    "contexts": $required_checks_json
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
PROTECTION
}

verify_branch_protection() {
  local repo=$1
  local required_reviews
  local required_check

  required_reviews=$(gh api "repos/$repo/branches/main/protection" --jq '.required_pull_request_reviews.required_approving_review_count // 0')
  [ "$required_reviews" -ge 1 ] || fail "Branch protection is missing the required pull request review gate on $repo"

  while IFS= read -r required_check; do
    [ -n "$required_check" ] || continue
    gh api "repos/$repo/branches/main/protection/required_status_checks" --jq '.contexts[]' | grep -Fx -- "$required_check" >/dev/null || \
      fail "Branch protection required status check '$required_check' is missing on $repo"
  done < <(printf '%s\n' "$PIPELINE_REQUIRED_STATUS_CHECKS" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
}

PRD_FILE="${1:-}"
[ -n "$PRD_FILE" ] || fail "Usage: push-to-pipeline.sh <prd-file>"
[ -f "$PRD_FILE" ] || fail "PRD file not found: $PRD_FILE"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
load_env_file "$HOME/.env"
load_env_file "$PROJECT_ROOT/.env"

require_command gh
require_command git
require_command jq

if ! gh aw --help >/dev/null 2>&1; then
  fail "gh-aw extension is required"
fi

if ! gh auth status >/dev/null 2>&1; then
  fail "gh CLI is not authenticated"
fi

SCAFFOLD_SOURCE_DIR="${SCAFFOLD_SOURCE_DIR:-$PROJECT_ROOT/dist/scaffold}"
[ -d "$SCAFFOLD_SOURCE_DIR" ] || fail "Scaffold dir not found: $SCAFFOLD_SOURCE_DIR — run scaffold/export-scaffold.sh first"
[ -f "$SCAFFOLD_SOURCE_DIR/.github/workflows/auto-dispatch.yml" ] || fail "Missing critical workflow in scaffold"

SCAFFOLD_EXPORT_MODE="${SCAFFOLD_EXPORT_MODE:-scaffold}"
TEMPLATE_REPO="${PIPELINE_TEMPLATE:-}"
TEMPLATE_SOURCE_DIR="${PIPELINE_TEMPLATE_SOURCE_DIR:-$SCAFFOLD_SOURCE_DIR}"
GH_OWNER="${PIPELINE_OWNER:-samuelkahessay}"
PIPELINE_APP_ID="${PIPELINE_APP_ID:-2995372}"
PIPELINE_BOT_LOGIN="${PIPELINE_BOT_LOGIN:-prd-to-prod-pipeline}"
PIPELINE_VISIBILITY="${PIPELINE_VISIBILITY:-public}"
PIPELINE_REQUIRED_STATUS_CHECKS="${PIPELINE_REQUIRED_STATUS_CHECKS:-review,Node CI / check-profile,Node CI / build-and-test}"
PIPELINE_APP_PRIVATE_KEY_FILE="${PIPELINE_APP_PRIVATE_KEY_FILE:-$HOME/.config/prd-to-prod/prd-to-prod-pipeline.2026-03-02.private-key.pem}"
VISIBILITY_FLAG=$(visibility_flag "$PIPELINE_VISIBILITY")

require_env COPILOT_GITHUB_TOKEN
require_env VERCEL_TOKEN
require_env VERCEL_ORG_ID
[ -n "$PIPELINE_APP_ID" ] || fail "PIPELINE_APP_ID must not be empty"

if [ -z "${PIPELINE_APP_PRIVATE_KEY:-}" ] && [ ! -r "$PIPELINE_APP_PRIVATE_KEY_FILE" ]; then
  if [ -e "$PIPELINE_APP_PRIVATE_KEY_FILE" ]; then
    fail "PIPELINE_APP_PRIVATE_KEY is not set and the fallback private key file is not readable: $PIPELINE_APP_PRIVATE_KEY_FILE"
  fi
  fail "PIPELINE_APP_PRIVATE_KEY is not set and no readable private key file was found at $PIPELINE_APP_PRIVATE_KEY_FILE"
fi

if [ -n "$TEMPLATE_SOURCE_DIR" ]; then
  [ -d "$TEMPLATE_SOURCE_DIR" ] || fail "PIPELINE_TEMPLATE_SOURCE_DIR does not exist: $TEMPLATE_SOURCE_DIR"
  git -C "$TEMPLATE_SOURCE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || \
    fail "PIPELINE_TEMPLATE_SOURCE_DIR must point to a git repository: $TEMPLATE_SOURCE_DIR"
  log "Creating repo from local template source $TEMPLATE_SOURCE_DIR..."
else
  gh repo view "$TEMPLATE_REPO" >/dev/null 2>&1 || fail "Template repo is not accessible: $TEMPLATE_REPO"
  log "Creating repo from template $TEMPLATE_REPO..."
fi

PRD_TITLE=$(head -1 "$PRD_FILE" | sed 's/^# PRD: //')
[ -n "$PRD_TITLE" ] || fail "PRD title could not be derived from the first line of $PRD_FILE"

REPO_NAME=$(normalize_suffix "$PRD_TITLE")
[ -n "$REPO_NAME" ] || fail "Could not derive a repository name from PRD title: $PRD_TITLE"

if [ -n "${PIPELINE_REPO_SUFFIX:-}" ]; then
  SUFFIX=$(normalize_suffix "$PIPELINE_REPO_SUFFIX")
  [ -n "$SUFFIX" ] || fail "PIPELINE_REPO_SUFFIX did not produce a valid suffix"
  REPO_NAME="${REPO_NAME}-${SUFFIX}"
fi

REPO="$GH_OWNER/$REPO_NAME"

if gh repo view "$REPO" >/dev/null 2>&1; then
  fail "Repository already exists: $REPO"
fi

if [ -n "$TEMPLATE_SOURCE_DIR" ]; then
  gh repo create "$REPO" "$VISIBILITY_FLAG" --source "$TEMPLATE_SOURCE_DIR" --push --remote origin >/dev/null
else
  gh repo create "$REPO" --template "$TEMPLATE_REPO" "$VISIBILITY_FLAG" --clone=false >/dev/null
fi

log "Waiting for repo $REPO to be ready..."
for _ in $(seq 1 15); do
  if gh repo view "$REPO" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
gh repo view "$REPO" >/dev/null 2>&1 || fail "Repository was not ready after creation: $REPO"

gh label create "pipeline" --repo "$REPO" --description "Pipeline-managed issue" --color "0075ca" 2>/dev/null || true
gh label create "feature" --repo "$REPO" --description "New feature" --color "a2eeef" 2>/dev/null || true

log "Enabling Actions PR permissions on $REPO..."
gh api "repos/$REPO/actions/permissions/workflow" --method PUT \
  -f "default_workflow_permissions=write" \
  -F "can_approve_pull_request_reviews=true" >/dev/null
verify_actions_permissions "$REPO"
log "Actions PR permissions configured"

log "Enabling auto-merge and branch protection on $REPO..."
gh api "repos/$REPO" --method PATCH -F allow_auto_merge=true >/dev/null
configure_branch_protection "$REPO"

ACTUAL_AUTO_MERGE=$(gh api "repos/$REPO" --jq '.allow_auto_merge')
[ "$ACTUAL_AUTO_MERGE" = "true" ] || fail "Auto-merge is not enabled on $REPO"
verify_branch_protection "$REPO"
log "Auto-merge and branch protection configured"

log "Configuring pipeline variables and secrets on $REPO..."
gh variable set PIPELINE_APP_ID --repo "$REPO" --body "$PIPELINE_APP_ID"
gh variable set PIPELINE_BOT_LOGIN --repo "$REPO" --body "$PIPELINE_BOT_LOGIN"

if [ -n "${PIPELINE_APP_PRIVATE_KEY:-}" ]; then
  gh secret set PIPELINE_APP_PRIVATE_KEY --repo "$REPO" --body "$PIPELINE_APP_PRIVATE_KEY"
else
  gh secret set PIPELINE_APP_PRIVATE_KEY --repo "$REPO" < "$PIPELINE_APP_PRIVATE_KEY_FILE"
fi

gh secret set COPILOT_GITHUB_TOKEN --repo "$REPO" --body "$COPILOT_GITHUB_TOKEN"
gh secret set VERCEL_TOKEN --repo "$REPO" --body "$VERCEL_TOKEN"
gh secret set VERCEL_ORG_ID --repo "$REPO" --body "$VERCEL_ORG_ID"

if [ -n "${GH_AW_GITHUB_TOKEN:-}" ]; then
  gh secret set GH_AW_GITHUB_TOKEN --repo "$REPO" --body "$GH_AW_GITHUB_TOKEN"
  log "Configured optional GH_AW_GITHUB_TOKEN break-glass secret"
fi

verify_repo_variable "$REPO" PIPELINE_APP_ID "$PIPELINE_APP_ID"
verify_repo_variable "$REPO" PIPELINE_BOT_LOGIN "$PIPELINE_BOT_LOGIN"
verify_repo_secret "$REPO" PIPELINE_APP_PRIVATE_KEY
verify_repo_secret "$REPO" COPILOT_GITHUB_TOKEN
verify_repo_secret "$REPO" VERCEL_TOKEN
verify_repo_secret "$REPO" VERCEL_ORG_ID

log "Compiling agent workflows..."
CLONE_DIR=$(mktemp -d)
cleanup_clone() {
  rm -rf "$CLONE_DIR"
}
trap cleanup_clone EXIT

gh repo clone "$REPO" "$CLONE_DIR" -- --quiet >/dev/null 2>&1
if ! (cd "$CLONE_DIR" && gh aw compile >/dev/null 2>&1); then
  log "First compile pass reported workflow dependency errors; retrying..."
fi
(cd "$CLONE_DIR" && gh aw compile >/dev/null 2>&1)

for lock_file in \
  .github/workflows/repo-assist.lock.yml \
  .github/workflows/prd-decomposer.lock.yml \
  .github/workflows/pr-review-agent.lock.yml
do
  [ -f "$CLONE_DIR/$lock_file" ] || fail "Compiled lock file missing after bootstrap: $lock_file"
done

(
  cd "$CLONE_DIR"
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "chore: compile gh-aw agent lock files" --quiet
    git push origin main --quiet
  fi
)

verify_remote_lock_file "$REPO" ".github/workflows/repo-assist.lock.yml"
verify_remote_lock_file "$REPO" ".github/workflows/prd-decomposer.lock.yml"
verify_remote_lock_file "$REPO" ".github/workflows/pr-review-agent.lock.yml"
log "Agent workflows compiled and verified"

log "Creating PRD issue in $REPO..."
ISSUE_URL=$(gh issue create \
  --repo "$REPO" \
  --title "[Pipeline] $PRD_TITLE" \
  --body-file "$PRD_FILE" \
  --label "pipeline" \
  --label "feature")

ISSUE_NUMBER=$(printf '%s' "$ISSUE_URL" | grep -o '[0-9]*$')
[ -n "$ISSUE_NUMBER" ] || fail "Could not parse issue number from $ISSUE_URL"
log "Created issue #$ISSUE_NUMBER: $ISSUE_URL"

gh issue comment "$ISSUE_NUMBER" \
  --repo "$REPO" \
  --body "/decompose" >/dev/null

log "Triggered /decompose on issue #$ISSUE_NUMBER"
log "Pipeline repo: https://github.com/$REPO"
log "Pipeline will now: decompose -> implement -> PR -> merge"

echo "PIPELINE_REPO=$REPO"
echo "PIPELINE_REPO_URL=https://github.com/$REPO"
echo "PIPELINE_ISSUE_NUMBER=$ISSUE_NUMBER"
echo "PIPELINE_ISSUE_URL=$ISSUE_URL"
