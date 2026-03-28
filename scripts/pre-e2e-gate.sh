#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
source "$REPO_ROOT/scripts/require-node.sh"

usage() {
  cat >&2 <<'USAGE'
Usage: pre-e2e-gate.sh [--skip-live] [--remote-harness]

Run the local and live readiness gate before burning tokens on a real E2E run.

Options:
  --skip-live    Skip live platform checks (GitHub/Fly/Vercel/template runtime checks)
  --remote-harness
                Validate remote-harness prerequisites. Local AI/auth checks still
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

  if [ "$branch" = "main" ]; then
    return 0
  fi

  if [ "${PRE_E2E_ALLOW_DETACHED_HEAD:-0}" = "1" ] && [ "$branch" = "HEAD" ]; then
    local head_ref main_ref
    head_ref=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "")
    main_ref=$(git -C "$REPO_ROOT" rev-parse main 2>/dev/null || echo "")
    if [ -n "$head_ref" ] && [ "$head_ref" = "$main_ref" ]; then
      return 0
    fi
  fi

  echo "Current branch is '$branch', expected 'main'." >&2
  return 1
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

resolve_local_ai_api_key() {
  local candidate=""

  for candidate in \
    "${E2E_OPENAI_API_KEY:-}" \
    "${PUBLIC_BETA_OPENAI_API_KEY:-}" \
    "${OPENAI_API_KEY:-}" \
    "${OPENROUTER_API_KEY:-}"
  do
    if [ -n "$candidate" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  return 1
}

probe_openai_api_key() {
  local token="$1"
  local url="${PRE_E2E_OPENAI_PROBE_URL:-https://api.openai.com/v1/models}"

  curl -sS -o /dev/null -w '%{http_code}' --max-time 20 --config - <<EOF
url = "$url"
header = "Authorization: Bearer $token"
header = "Content-Type: application/json"
EOF
}

check_local_agent_api_key() {
  local token status
  token=$(resolve_local_ai_api_key || true)
  if [ -z "$token" ]; then
    echo "No local AI API key resolved for the E2E harness." >&2
    return 1
  fi

  status=$(probe_openai_api_key "$token" 2>/dev/null || true)
  case "$status" in
    200)
      printf "Resolved local AI API key authenticated with OpenAI.\n"
      return 0
      ;;
    401|403)
      echo "Resolved local AI API key was rejected by OpenAI (HTTP $status)." >&2
      return 1
      ;;
    *)
      echo "Resolved local AI API key probe returned unexpected status '$status'." >&2
      return 1
      ;;
  esac
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

check_vercel_web() {
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://prdtoprod.com)
  case "$code" in
    200|301|302|307|308) ;;
    *)
      echo "Unexpected web status code: $code" >&2
      return 1
      ;;
  esac
}

check_template_repo() {
  gh repo view samuelkahessay/prd-to-prod-template --json isTemplate --jq '.isTemplate' | grep -qx 'true'
}

check_template_files() {
  gh api repos/samuelkahessay/prd-to-prod-template/contents/web/package.json --jq '.name' | grep -qx 'package.json'
  gh api repos/samuelkahessay/prd-to-prod-template/contents/web/next.config.ts --jq '.name' | grep -qx 'next.config.ts'
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

run_fly_runtime_command() {
  local command="$1"
  local timeout_seconds="${PRE_E2E_FLY_SECRET_TIMEOUT_SECONDS:-20}"
  python3 - "$command" "$timeout_seconds" <<'PY'
import subprocess
import sys

command = sys.argv[1]
timeout_seconds = int(sys.argv[2])

try:
    result = subprocess.run(
        ["fly", "ssh", "console", "--app", "prd-to-prod", "-C", command],
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )
except subprocess.TimeoutExpired:
    sys.stderr.write(f"Timed out running '{command}' against the Fly runtime.\n")
    sys.exit(124)

if result.returncode != 0:
    sys.stderr.write(result.stderr.replace("\r", ""))
    sys.exit(result.returncode)

sys.stdout.write(result.stdout.replace("\r", "").strip())
PY
}

read_fly_runtime_secret() {
  local secret_name="$1"
  run_fly_runtime_command "printenv ${secret_name}"
}

check_fly_runtime_secret_set() {
  local secret_name="$1"
  run_fly_runtime_command "test -n \"\$$secret_name\" && echo set"
}

check_runtime_agent_api_key() {
  local marker
  marker=$(check_fly_runtime_secret_set "OPENAI_API_KEY")
  if [ -z "$marker" ]; then
    echo "OPENAI_API_KEY is missing from the Fly runtime." >&2
    return 1
  fi
  printf "Detected AI API key in Fly runtime.\n"
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
  value=$(check_fly_runtime_secret_set "PIPELINE_APP_ID")
  if [ -z "$value" ]; then
    echo "PIPELINE_APP_ID is missing from the Fly runtime." >&2
    return 1
  fi
  printf "Detected PIPELINE_APP_ID in Fly runtime.\n"
}

check_runtime_pipeline_app_private_key() {
  local value
  value=$(check_fly_runtime_secret_set "PIPELINE_APP_PRIVATE_KEY")
  if [ -z "$value" ]; then
    if [ "$REMOTE_HARNESS" = true ]; then
      echo "PIPELINE_APP_PRIVATE_KEY could not be validated via Fly console; treating this as advisory in remote-harness mode because live provisioning is the authoritative check." >&2
      return 0
    fi
    echo "PIPELINE_APP_PRIVATE_KEY is missing from the Fly runtime." >&2
    return 1
  fi
  printf "Detected PIPELINE_APP_PRIVATE_KEY in Fly runtime.\n"
}

run_check "Source: on main branch" check_main_branch
run_check "Source: working tree is clean" check_clean_tree
run_check "Local: console preflight required checks pass" check_console_preflight
run_check "Local: resolved AI API key authenticates with OpenAI" check_local_agent_api_key

run_check "App: console dependencies ready" ensure_node_dependencies "console" "console"
run_check "App: web dependencies ready" ensure_node_dependencies "web" "web"
run_check_eval "App: console Jest" "cd console && npm test"
run_check_eval "App: web Jest" "cd web && npm test"
run_check_eval "App: web build" "cd web && npm run build"

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
  run_check "Live: Vercel web reachable" check_vercel_web
  run_check "Live: template repo is published" check_template_repo
  run_check "Live: template scaffold files and deploy profile exist" check_template_files
  run_check "Live: Fly runtime AI API key exists" check_runtime_agent_api_key
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
