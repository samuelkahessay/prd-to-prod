#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

usage() {
  cat >&2 <<'USAGE'
Usage: pre-e2e-gate.sh [--skip-live] [--remote-harness]

Run the local and live readiness gate before burning tokens on a real E2E run.

Options:
  --skip-live    Skip live platform checks (GitHub/Fly/Vercel/template runtime checks)
  --remote-harness
                Validate remote-harness prerequisites. Local Copilot/auth checks still
                run, but platform secrets are validated against the deployed runtime.
  -h, --help     Show this help

Exit codes:
  0  All checks passed
  1  One or more checks failed
  2  Usage error
USAGE
  exit 2
}

SKIP_LIVE=false
REMOTE_HARNESS=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-live) SKIP_LIVE=true; shift ;;
    --remote-harness) REMOTE_HARNESS=true; shift ;;
    -h|--help) usage ;;
    *) usage ;;
  esac
done

PASS=0
FAIL=0
TOTAL=0

run_check() {
  local label="$1"
  shift

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

run_check_eval() {
  local label="$1"
  local command="$2"

  TOTAL=$((TOTAL + 1))
  printf "==> %s\n" "$label"
  if (cd "$REPO_ROOT" && eval "$command") 2>&1; then
    printf "    [PASS]\n\n"
    PASS=$((PASS + 1))
  else
    printf "    [FAIL]\n\n"
    FAIL=$((FAIL + 1))
  fi
}

check_main_branch() {
  local branch
  branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  if [ "$branch" != "main" ]; then
    echo "Current branch is '$branch', expected 'main'." >&2
    return 1
  fi
}

check_clean_tree() {
  local dirty
  dirty=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || echo "dirty")
  if [ -n "$dirty" ]; then
    echo "Working tree is dirty." >&2
    return 1
  fi
}

check_console_preflight() {
  local mode="local"
  if [ "$REMOTE_HARNESS" = true ]; then
    mode="remote-harness"
  fi

  local output
  output=$(cd "$REPO_ROOT" && PRE_E2E_PREFLIGHT_MODE="$mode" node - <<'NODE'
const { runPreflight } = require("./console/lib/preflight");

const mode = process.env.PRE_E2E_PREFLIGHT_MODE || "local";
const checks = runPreflight(process.cwd(), process.env, { mode });
const failed = checks.filter((check) => check.required && !check.present);

for (const check of checks) {
  const status = check.present ? "PASS" : check.required ? "FAIL" : "WARN";
  const detail = check.detail ? ` - ${check.detail}` : "";
  console.log(`${status}\t${check.id}\t${check.name}${detail}`);
}

if (failed.length > 0) {
  process.exit(1);
}
NODE
  ) || {
    printf '%s\n' "$output"
    return 1
  }

  printf '%s\n' "$output"
}

ensure_node_dependencies() {
  local app_dir="$1"
  local app_name="$2"
  local sqlite_probe='const Database = require("better-sqlite3"); const db = new Database(":memory:"); db.close();'

  if [ ! -d "$REPO_ROOT/$app_dir/node_modules" ]; then
    npm --prefix "$REPO_ROOT/$app_dir" ci
    return
  fi

  if [ "$app_dir" = "console" ] && ! (cd "$REPO_ROOT/$app_dir" && node -e "$sqlite_probe" >/dev/null 2>&1); then
    echo "Rebuilding better-sqlite3 for the current Node.js version in ${app_name}..."
    npm --prefix "$REPO_ROOT/$app_dir" rebuild better-sqlite3
    if ! (cd "$REPO_ROOT/$app_dir" && node -e "$sqlite_probe" >/dev/null 2>&1); then
      echo "better-sqlite3 is still incompatible with the active Node.js runtime after rebuild." >&2
      return 1
    fi
  fi
}

check_github_api() {
  gh api /status >/dev/null
}

check_github_actions_health() {
  curl -fsS --max-time 15 https://www.githubstatus.com/api/v2/components.json \
    | jq -e '.components[] | select(.name == "Actions" and .status == "operational")' >/dev/null
}

check_fly_health() {
  curl -fsS --max-time 15 https://prd-to-prod.fly.dev/healthz \
    | jq -e '.status == "ok"' >/dev/null
}

check_vercel_studio() {
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://prdtoprod.com)
  case "$code" in
    200|301|302|307|308) ;;
    *)
      echo "Unexpected studio status code: $code" >&2
      return 1
      ;;
  esac
}

check_template_repo() {
  gh repo view samuelkahessay/prd-to-prod-template --json isTemplate --jq '.isTemplate' | grep -qx 'true'
}

check_template_files() {
  gh api repos/samuelkahessay/prd-to-prod-template/contents/studio/package.json --jq '.name' | grep -qx 'package.json'
  gh api repos/samuelkahessay/prd-to-prod-template/contents/studio/next.config.ts --jq '.name' | grep -qx 'next.config.ts'
  gh api repos/samuelkahessay/prd-to-prod-template/contents/.deploy-profile --jq '.content' \
    | base64 -d \
    | tr -d '\n' \
    | grep -qx 'nextjs-vercel'
}

check_main_ci_green() {
  gh run list \
    --repo samuelkahessay/prd-to-prod \
    --branch main \
    --status success \
    --limit 1 \
    --json conclusion \
    | jq -e 'length > 0 and .[0].conclusion == "success"' >/dev/null
}

read_fly_runtime_secret() {
  local secret_name="$1"
  fly ssh console --app prd-to-prod -C "printenv ${secret_name}" 2>/dev/null | tr -d '\r'
}

check_runtime_copilot_token() {
  local token
  token=$(read_fly_runtime_secret "COPILOT_GITHUB_TOKEN")
  if [ -z "$token" ]; then
    echo "COPILOT_GITHUB_TOKEN is missing from the Fly runtime." >&2
    return 1
  fi
  case "$token" in
    github_pat_*)
      printf "Detected fine-grained Copilot PAT in Fly runtime.\n"
      ;;
    ghp_*)
      echo "Fly runtime still has a classic Copilot PAT; use github_pat_." >&2
      return 1
      ;;
    *)
      echo "Fly runtime Copilot token format is unrecognized." >&2
      return 1
      ;;
  esac
}

check_runtime_workflow_token() {
  local token
  token=$(read_fly_runtime_secret "GH_AW_GITHUB_TOKEN")
  if [ -z "$token" ]; then
    echo "GH_AW_GITHUB_TOKEN is missing from the Fly runtime." >&2
    return 1
  fi
  case "$token" in
    ghp_*|github_pat_*)
      printf "Detected workflow dispatch PAT in Fly runtime.\n"
      ;;
    *)
      echo "Fly runtime workflow token format is unrecognized." >&2
      return 1
      ;;
  esac
}

check_runtime_pipeline_app_id() {
  local value
  value=$(read_fly_runtime_secret "PIPELINE_APP_ID")
  if [ -z "$value" ]; then
    echo "PIPELINE_APP_ID is missing from the Fly runtime." >&2
    return 1
  fi
  printf "Detected PIPELINE_APP_ID in Fly runtime.\n"
}

check_runtime_pipeline_app_private_key() {
  local value
  value=$(read_fly_runtime_secret "PIPELINE_APP_PRIVATE_KEY")
  if [ -z "$value" ]; then
    echo "PIPELINE_APP_PRIVATE_KEY is missing from the Fly runtime." >&2
    return 1
  fi
  printf "Detected PIPELINE_APP_PRIVATE_KEY in Fly runtime.\n"
}

run_check "Source: on main branch" check_main_branch
run_check "Source: working tree is clean" check_clean_tree
run_check "Local: console preflight required checks pass" check_console_preflight

run_check "App: console dependencies ready" ensure_node_dependencies "console" "console"
run_check "App: studio dependencies ready" ensure_node_dependencies "studio" "studio"
run_check_eval "App: console Jest" "cd console && npm test"
run_check_eval "App: studio Jest" "cd studio && npm test"
run_check_eval "App: studio build" "cd studio && npm run build"

run_check_eval "Contracts: final validation matrix" "bash scripts/tests/test-final-validation-matrix.sh"
run_check_eval "Contracts: auto-dispatch requeue" "bash scripts/tests/test-auto-dispatch-requeue.sh"
run_check_eval "Contracts: self-healing dispatch substate" "bash scripts/tests/test-self-healing-drill-dispatch-substate.sh"
run_check_eval "Contracts: self-healing workflow matching" "bash scripts/tests/test-self-healing-drill-workflow-matching.sh"
run_check_eval "Contracts: pipeline watchdog" "bash scripts/tests/test-pipeline-watchdog.sh"

if [ "$SKIP_LIVE" = false ]; then
  run_check "Live: GitHub API responding" check_github_api
  run_check "Live: GitHub Actions operational" check_github_actions_health
  run_check "Live: main CI green" check_main_ci_green
  run_check "Live: Fly console health" check_fly_health
  run_check "Live: Vercel studio reachable" check_vercel_studio
  run_check "Live: template repo is published" check_template_repo
  run_check "Live: template scaffold files and deploy profile exist" check_template_files
  run_check "Live: Fly runtime Copilot token is fine-grained" check_runtime_copilot_token
  run_check "Live: Fly runtime workflow token exists" check_runtime_workflow_token
  run_check "Live: Fly runtime pipeline app id exists" check_runtime_pipeline_app_id
  run_check "Live: Fly runtime pipeline app private key exists" check_runtime_pipeline_app_private_key
fi

if [ "$FAIL" -eq 0 ]; then
  printf "PASS (%d checks)\n" "$PASS"
  exit 0
fi

printf "FAIL (%d failed of %d)\n" "$FAIL" "$TOTAL"
exit 1
