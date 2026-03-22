#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
STATE_ROOT="${E2E_STATE_ROOT:-$ROOT_DIR}"
DEPENDENCY_SOURCE_ROOT="${E2E_PROVISION_SMOKE_DEPENDENCY_SOURCE_ROOT:-$ROOT_DIR}"
RUNTIME_ENV_SCRIPT="${E2E_RUNTIME_ENV_SCRIPT:-$ROOT_DIR/scripts/e2e/runtime-env.sh}"
HARNESS_SCRIPT="${E2E_HARNESS_SCRIPT:-}"
HARNESS_JS="$ROOT_DIR/scripts/e2e/harness.js"
ENV_FILE="${E2E_RUNTIME_ENV_FILE:-$STATE_ROOT/docs/internal/.e2e-runtime-env}"
COOKIE_JAR_PATH="${E2E_COOKIE_JAR_PATH:-$STATE_ROOT/docs/internal/.e2e-cookiejar}"

REFRESH_ENV=0
KEEP_REPO=0
AUTO_WORKTREE=1
WORKTREE_REF="${E2E_PROVISION_SMOKE_REF:-HEAD}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh-env)
      REFRESH_ENV=1
      shift
      ;;
    --keep-repo)
      KEEP_REPO=1
      shift
      ;;
    --no-clean-worktree)
      AUTO_WORKTREE=0
      shift
      ;;
    --ref)
      WORKTREE_REF="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --cookie-jar)
      COOKIE_JAR_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

maybe_reexec_in_clean_worktree() {
  if [[ "${E2E_PROVISION_SMOKE_CHILD:-0}" == 1 || "${E2E_PROVISION_SMOKE_DISABLE_WORKTREE:-0}" == 1 || "$AUTO_WORKTREE" -eq 0 ]]; then
    return 0
  fi

  local dirty
  dirty=$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null || true)
  if [[ -z "$dirty" ]]; then
    return 0
  fi

  local worktree_dir
  worktree_dir=$(mktemp -d "${TMPDIR:-/tmp}/prd-to-prod-e2e-smoke-XXXXXX")

  cleanup_worktree() {
    git -C "$ROOT_DIR" worktree remove --force "$worktree_dir" >/dev/null 2>&1 || true
    rm -rf "$worktree_dir"
  }

  trap cleanup_worktree EXIT
  git -C "$ROOT_DIR" worktree add --detach "$worktree_dir" "$WORKTREE_REF" >/dev/null
  copy_worktree_dependencies "$worktree_dir"

  echo "Working tree is dirty. Re-running provision smoke from clean worktree $worktree_dir"

  local -a child_env
  child_env=(
    "E2E_PROVISION_SMOKE_CHILD=1"
    "E2E_STATE_ROOT=$STATE_ROOT"
    "E2E_RUNTIME_ENV_FILE=$ENV_FILE"
    "E2E_COOKIE_JAR_PATH=$COOKIE_JAR_PATH"
    "PRE_E2E_ALLOW_DETACHED_HEAD=1"
    "SKIP_E2E_PROVISION_SMOKE_TEST=1"
  )

  if [[ -n "${E2E_RUNTIME_ENV_SCRIPT:-}" ]]; then
    child_env+=("E2E_RUNTIME_ENV_SCRIPT=$E2E_RUNTIME_ENV_SCRIPT")
  fi

  if [[ -n "${E2E_HARNESS_SCRIPT:-}" ]]; then
    child_env+=("E2E_HARNESS_SCRIPT=$E2E_HARNESS_SCRIPT")
  fi

  if [[ -n "${E2E_PROVISION_SMOKE_REF:-}" ]]; then
    child_env+=("E2E_PROVISION_SMOKE_REF=$E2E_PROVISION_SMOKE_REF")
  fi

  if [[ -n "${E2E_PROVISION_SMOKE_DEPENDENCY_SOURCE_ROOT:-}" ]]; then
    child_env+=("E2E_PROVISION_SMOKE_DEPENDENCY_SOURCE_ROOT=$E2E_PROVISION_SMOKE_DEPENDENCY_SOURCE_ROOT")
  fi

  local child_status=0
  if env "${child_env[@]}" bash "$worktree_dir/scripts/e2e/provision-smoke.sh" "$@"; then
    child_status=0
  else
    child_status=$?
  fi
  sync_worktree_reports "$worktree_dir"
  exit "$child_status"
}

copy_dependency_dir() {
  local source_dir="$1"
  local dest_dir="$2"

  if [[ ! -d "$source_dir" || -e "$dest_dir" ]]; then
    return 0
  fi

  if cp -cR "$source_dir" "$dest_dir" 2>/dev/null; then
    return 0
  fi

  mkdir -p "$dest_dir"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$source_dir"/ "$dest_dir"/ >/dev/null
    return 0
  fi

  cp -R "$source_dir"/. "$dest_dir"/
}

copy_worktree_dependencies() {
  local worktree_dir="$1"
  local app_dir

  for app_dir in console studio; do
    copy_dependency_dir "$DEPENDENCY_SOURCE_ROOT/$app_dir/node_modules" "$worktree_dir/$app_dir/node_modules"
  done
}

sync_worktree_reports() {
  local worktree_dir="$1"
  local source_dir target_dir report_path relative_path

  for source_dir in "$worktree_dir/output/e2e" "$worktree_dir/docs/internal/e2e-runs"; do
    if [[ ! -d "$source_dir" ]]; then
      continue
    fi

    relative_path="${source_dir#$worktree_dir/}"
    target_dir="$STATE_ROOT/$relative_path"
    mkdir -p "$target_dir"

    while IFS= read -r report_path; do
      local relative_report
      relative_report="${report_path#$source_dir/}"
      mkdir -p "$target_dir/$(dirname "$relative_report")"
      cp "$report_path" "$target_dir/$relative_report"
    done < <(find "$source_dir" -type f)
  done
}

ensure_console_runtime_compatible() {
  if [[ -n "$HARNESS_SCRIPT" ]]; then
    return 0
  fi

  local sqlite_probe='const Database = require("better-sqlite3"); const db = new Database(":memory:"); db.close();'
  if (cd "$ROOT_DIR/console" && node -e "$sqlite_probe" >/dev/null 2>&1); then
    return 0
  fi

  echo "Rebuilding better-sqlite3 for Node $(node -v) in $ROOT_DIR/console"
  npm --prefix "$ROOT_DIR/console" rebuild better-sqlite3 >/dev/null
}

run_harness() {
  if [[ -n "$HARNESS_SCRIPT" ]]; then
    bash "$HARNESS_SCRIPT" "$@"
    return
  fi

  ensure_console_runtime_compatible
  node "$HARNESS_JS" "$@"
}

maybe_reexec_in_clean_worktree "$@"

if [[ ! -f "$ENV_FILE" || "$REFRESH_ENV" -eq 1 ]]; then
  bash "$RUNTIME_ENV_SCRIPT" refresh --path "$ENV_FILE"
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

run_harness auth-check --path "$COOKIE_JAR_PATH"

RUN_ARGS=(run --lane provision-only --path "$COOKIE_JAR_PATH")
if [[ "$KEEP_REPO" -eq 1 ]]; then
  RUN_ARGS+=(--keep-repo)
fi

run_harness "${RUN_ARGS[@]}"
