#!/usr/bin/env bash
set -euo pipefail

TEMP_FILE=""
cleanup() { [[ -n "$TEMP_FILE" ]] && rm -f "$TEMP_FILE" || true; }
trap cleanup EXIT

###############################################################################
# setup.sh — Interactive setup wizard for prd-to-prod template repos
#
# Guides new users through configuring their repo after clicking
# "Use this template". Replaces manual README steps with a 5-minute
# guided experience.
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

info()   { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()   { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
error()  { printf "${RED}✗${NC} %s\n" "$1" >&2; }
header() { printf "\n${BOLD}=== %s ===${NC}\n\n" "$1"; }

# ---------------------------------------------------------------------------
# Platform detection for sed -i compatibility
# ---------------------------------------------------------------------------
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed_inplace() { sed -i '' "$@"; }
else
  sed_inplace() { sed -i "$@"; }
fi

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
NON_INTERACTIVE=false
APP_DIR=""
SENSITIVE_DIRS=""

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: ./setup.sh [OPTIONS]

Interactive setup wizard for prd-to-prod template repos.

Options:
  --non-interactive       Run without prompts (uses defaults or flags)
  --app-dir DIR           Application source directory (default: src)
  --sensitive-dirs DIRS   Comma-separated sensitive directories (default: auth,compliance,payments)
  -h, --help              Show this help message

Examples:
  ./setup.sh                                          # Interactive mode
  ./setup.sh --non-interactive                        # Accept all defaults
  ./setup.sh --app-dir myapp --sensitive-dirs auth,billing
  ./setup.sh --non-interactive --app-dir lib --sensitive-dirs security,payments
EOF
  exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --app-dir)
      [[ -z "${2:-}" ]] && { error "--app-dir requires a value"; exit 1; }
      APP_DIR="$2"; shift 2 ;;
    --sensitive-dirs)
      [[ -z "${2:-}" ]] && { error "--sensitive-dirs requires a value"; exit 1; }
      SENSITIVE_DIRS="$2"; shift 2 ;;
    -h|--help) usage ;;
    *)
      error "Unknown option: $1"
      echo "Run ./setup.sh --help for usage."
      exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Prompt helper — uses default in non-interactive mode
# ---------------------------------------------------------------------------
prompt() {
  local var_name="$1" message="$2" default="$3"
  if [[ "$NON_INTERACTIVE" == true ]]; then
    printf -v "$var_name" '%s' "$default"
  else
    printf "%s [%s]: " "$message" "$default"
    local input
    read -r input
    printf -v "$var_name" '%s' "${input:-$default}"
  fi
}

prompt_secret() {
  local var_name="$1" message="$2"
  if [[ "$NON_INTERACTIVE" == true ]]; then
    printf -v "$var_name" '%s' ""
  else
    printf "%s: " "$message"
    local input
    read -rs input
    echo ""
    printf -v "$var_name" '%s' "$input"
  fi
}

###############################################################################
# Step 1: Prerequisites
###############################################################################
header "Step 1: Checking Prerequisites"

MISSING=()

if command -v gh >/dev/null 2>&1; then
  info "gh CLI found"
else
  MISSING+=("gh CLI — install from https://cli.github.com/")
fi

if command -v git >/dev/null 2>&1; then
  info "git found"
else
  MISSING+=("git — install from https://git-scm.com/")
fi

if gh aw version >/dev/null 2>&1; then
  info "gh-aw extension found"
else
  MISSING+=("gh-aw extension — install with: gh extension install github/gh-aw")
fi

if gh auth status >/dev/null 2>&1; then
  info "gh auth status OK"
else
  MISSING+=("gh auth — run: gh auth login")
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  error "Missing prerequisites:"
  for item in "${MISSING[@]}"; do
    echo "  - $item"
  done
  exit 1
fi

info "All prerequisites met"

###############################################################################
# Step 2: Application Directory
###############################################################################
header "Step 2: Application Directory"

if [[ -n "$APP_DIR" ]]; then
  # Already set via --app-dir flag
  true
else
  prompt APP_DIR "Where will your application source code live?" "src"
fi

# Strip trailing slashes
APP_DIR="${APP_DIR%/}"

info "Application directory: $APP_DIR"

###############################################################################
# Step 3: Sensitive Directories
###############################################################################
header "Step 3: Sensitive Directories"

echo "Sensitive directories get extra human-review requirements."
echo "These are subdirectories within your app (e.g., auth, compliance, payments)."
echo ""

if [[ -n "$SENSITIVE_DIRS" ]]; then
  # Already set via --sensitive-dirs flag
  true
else
  prompt SENSITIVE_DIRS "Comma-separated sensitive directories" "auth,compliance,payments"
fi

info "Sensitive directories: $SENSITIVE_DIRS"

###############################################################################
# Step 4: Patch autonomy-policy.yml
###############################################################################
header "Step 4: Configuring Autonomy Policy"

POLICY_FILE="$REPO_ROOT/autonomy-policy.yml"

if [[ ! -f "$POLICY_FILE" ]]; then
  error "autonomy-policy.yml not found at $POLICY_FILE"
  exit 1
fi

# 4a: Replace app directory in app_code_change if not default "src"
if [[ "$APP_DIR" != "src" ]]; then
  # Replace the exact line "      - src/**" (app_code_change target) but not
  # the sensitive path lines like "      - src/**/auth/**"
  ESCAPED_APP_DIR=$(printf '%s\n' "$APP_DIR" | sed 's/[&\\/]/\\&/g')
  sed_inplace "s|^      - src/\*\*$|      - ${ESCAPED_APP_DIR}/**|" "$POLICY_FILE"
  info "Replaced src/** with ${APP_DIR}/** in app_code_change"
else
  info "App directory is 'src' (default) — no app_code_change patch needed"
fi

# 4b: Replace sensitive path lines
# Build the replacement lines from SENSITIVE_DIRS
IFS=',' read -ra SENS_ARRAY <<< "$SENSITIVE_DIRS"
REPLACEMENT_LINES=""
for dir in "${SENS_ARRAY[@]}"; do
  dir="$(echo "$dir" | xargs)"  # trim whitespace
  REPLACEMENT_LINES+="      - ${APP_DIR}/**/${dir}/**\n"
done

# Use awk to replace the 3 default sensitive lines with user's lines
# Match: lines that look like "      - src/**/auth/**" etc (the original defaults)
# or lines matching "      - <any>/**/some_dir/**" if this script has been run before
# Strategy: find the sensitive_app_change block, replace the allowed_targets entries
TEMP_FILE=$(mktemp)

awk -v replacement="$REPLACEMENT_LINES" '
BEGIN { in_sensitive = 0; targets_started = 0; replaced = 0 }
/action: sensitive_app_change/ { in_sensitive = 1 }
in_sensitive && /allowed_targets:/ { targets_started = 1; print; next }
targets_started && /^      - / {
  if (!replaced) {
    printf "%s", replacement
    replaced = 1
  }
  next
}
targets_started && !/^      - / {
  # We have left the allowed_targets list
  targets_started = 0
  in_sensitive = 0
}
{ print }
' "$POLICY_FILE" > "$TEMP_FILE"

cat "$TEMP_FILE" > "$POLICY_FILE"
rm -f "$TEMP_FILE"

info "Updated sensitive paths to: ${SENSITIVE_DIRS}"

###############################################################################
# Step 5: Pipeline Authentication
###############################################################################
header "Step 5: Pipeline Authentication"

echo "The pipeline needs elevated permissions for auto-merge, issue creation,"
echo "and workflow dispatch (bypasses GitHub's anti-cascade rule)."
echo ""
echo "Two options:"
echo "  1. GitHub App (recommended) — auto-rotating tokens, scoped per job"
echo "  2. Personal Access Token (PAT) — simpler setup, manual rotation"
echo ""

if [[ "$NON_INTERACTIVE" == true ]]; then
  AUTH_METHOD="2"
  warn "Non-interactive mode: defaulting to PAT auth"
else
  prompt AUTH_METHOD "Auth method (1=App, 2=PAT)" "1"
fi

if [[ "$AUTH_METHOD" == "1" ]]; then
  # GitHub App path
  echo ""
  echo "Install the prd-to-prod pipeline App on your repo, then provide:"
  echo "  - PIPELINE_APP_ID (from App settings page)"
  echo "  - PIPELINE_APP_PRIVATE_KEY (generate in App settings > Private keys)"
  echo ""

  if [[ "$NON_INTERACTIVE" == true ]]; then
    warn "Non-interactive mode: set App credentials manually:"
    echo "  gh variable set PIPELINE_APP_ID"
    echo "  gh secret set PIPELINE_APP_PRIVATE_KEY"
  else
    prompt APP_ID_VALUE "PIPELINE_APP_ID" ""
    if [[ -n "$APP_ID_VALUE" ]]; then
      gh variable set PIPELINE_APP_ID --body "$APP_ID_VALUE"
      info "PIPELINE_APP_ID variable set"
    else
      warn "Empty value — set it later: gh variable set PIPELINE_APP_ID"
    fi

    prompt_secret APP_KEY_VALUE "PIPELINE_APP_PRIVATE_KEY (paste PEM, then Enter)"
    if [[ -n "$APP_KEY_VALUE" ]]; then
      echo "$APP_KEY_VALUE" | gh secret set PIPELINE_APP_PRIVATE_KEY
      info "PIPELINE_APP_PRIVATE_KEY secret set"
    else
      warn "Empty value — set it later: gh secret set PIPELINE_APP_PRIVATE_KEY"
    fi
  fi
else
  # PAT path
  echo ""
  echo "Create a fine-grained PAT with 'repo' and 'workflow' scopes."
  echo "Guide: https://docs.github.com/en/authentication/creating-a-personal-access-token"
  echo ""

  if [[ "$NON_INTERACTIVE" == true ]]; then
    warn "Non-interactive mode: set the PAT manually with:"
    echo "  gh secret set GH_AW_GITHUB_TOKEN"
  else
    prompt SETUP_PAT_NOW "Set GH_AW_GITHUB_TOKEN now? (y/n)" "y"
    if [[ "$SETUP_PAT_NOW" =~ ^[Yy] ]]; then
      prompt_secret PAT_VALUE "Paste your PAT (input hidden)"
      if [[ -n "$PAT_VALUE" ]]; then
        echo "$PAT_VALUE" | gh secret set GH_AW_GITHUB_TOKEN
        info "GH_AW_GITHUB_TOKEN set"
      else
        warn "Empty value — skipping. Set it later: gh secret set GH_AW_GITHUB_TOKEN"
      fi
    else
      warn "Skipped. Set it later: gh secret set GH_AW_GITHUB_TOKEN"
    fi
  fi
fi

###############################################################################
# Step 6: Vercel Secrets (optional — skip if using a different deploy target)
###############################################################################
header "Step 6: Vercel Deployment Secrets"

echo "Vercel is the default deployment target (nextjs-vercel profile)."
echo "Skip this step if you plan to use a different deployment provider."
echo ""
echo "For Vercel deployment, the pipeline needs three secrets:"
echo "  - VERCEL_TOKEN       — your Vercel API token"
echo "  - VERCEL_ORG_ID      — your Vercel organization ID"
echo "  - VERCEL_PROJECT_ID  — your Vercel project ID"
echo ""

if [[ "$NON_INTERACTIVE" == true ]]; then
  info "Non-interactive mode: Vercel secrets are optional."
  info "If using Vercel, set secrets manually:"
  echo "  gh secret set VERCEL_TOKEN"
  echo "  gh secret set VERCEL_ORG_ID"
  echo "  gh secret set VERCEL_PROJECT_ID"
else
  prompt SKIP_VERCEL "Skip Vercel setup? (y/N)" "n"
  if [[ "$SKIP_VERCEL" =~ ^[Yy] ]]; then
    info "Skipping Vercel setup. You can configure deployment secrets later:"
    echo "  gh secret set VERCEL_TOKEN"
    echo "  gh secret set VERCEL_ORG_ID"
    echo "  gh secret set VERCEL_PROJECT_ID"
  else
    prompt_secret VERCEL_TOKEN_VALUE "VERCEL_TOKEN (input hidden)"
    if [[ -n "$VERCEL_TOKEN_VALUE" ]]; then
      echo "$VERCEL_TOKEN_VALUE" | gh secret set VERCEL_TOKEN
      info "VERCEL_TOKEN set"
    else
      warn "Empty value — skipping VERCEL_TOKEN"
    fi

    prompt VERCEL_ORG_VALUE "VERCEL_ORG_ID" ""
    if [[ -n "$VERCEL_ORG_VALUE" ]]; then
      echo "$VERCEL_ORG_VALUE" | gh secret set VERCEL_ORG_ID
      info "VERCEL_ORG_ID set"
    else
      warn "Empty value — skipping VERCEL_ORG_ID"
    fi

    prompt VERCEL_PROJECT_VALUE "VERCEL_PROJECT_ID" ""
    if [[ -n "$VERCEL_PROJECT_VALUE" ]]; then
      echo "$VERCEL_PROJECT_VALUE" | gh secret set VERCEL_PROJECT_ID
      info "VERCEL_PROJECT_ID set"
    else
      warn "Empty value — skipping VERCEL_PROJECT_ID"
    fi
  fi
fi

###############################################################################
# Step 7: Run Bootstrap
###############################################################################
header "Step 7: Running Bootstrap"

echo "This creates labels, compiles gh-aw workflows, seeds repo memory,"
echo "and configures repo settings."
echo ""

if ! bash "$REPO_ROOT/scripts/bootstrap.sh"; then
  warn "Bootstrap had errors (see above). Some steps may need manual re-run."
  warn "You can re-run bootstrap later with: ./scripts/bootstrap.sh"
else
  info "Bootstrap complete"
fi

###############################################################################
# Step 8: AI Engine Configuration
###############################################################################
header "Step 8: AI Engine Configuration"

echo "gh-aw needs an AI engine (GitHub Copilot, Claude, or Codex) configured"
echo "to power the pipeline agents."
echo ""

if [[ "$NON_INTERACTIVE" == true ]]; then
  warn "Non-interactive mode: configure AI engine manually:"
  echo "  gh aw secrets bootstrap"
else
  prompt RUN_AW_SECRETS "Run 'gh aw secrets bootstrap' now? (y/n)" "y"
  if [[ "$RUN_AW_SECRETS" =~ ^[Yy] ]]; then
    gh aw secrets bootstrap || {
      warn "gh aw secrets bootstrap failed — run it manually later"
    }
  else
    warn "Skipped. Run it later with: gh aw secrets bootstrap"
  fi
fi

###############################################################################
# Done
###############################################################################
header "Setup Complete!"

echo "Remaining manual steps:"
echo ""
echo "  1. Push your changes:"
echo "     git add -A && git commit -m 'Configure pipeline for my project' && git push"
echo ""
echo "  2. Set up branch protection for main:"
echo "     - Require 1 approving review"
echo "     - Require the 'review' status check"
echo "     - Allow squash merges only"
echo ""
echo "  3. Submit your first PRD:"
echo "     Create an issue with your product requirements, then comment /decompose"
echo "     Or: gh aw run prd-decomposer"
echo ""
echo "  Run ${BOLD}./setup-verify.sh${NC} to check your configuration."
echo ""
info "Happy building!"
