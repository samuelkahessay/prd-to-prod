#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
RUNTIME_ENV_SCRIPT="${E2E_RUNTIME_ENV_SCRIPT:-$ROOT_DIR/scripts/e2e/runtime-env.sh}"
HARNESS_SCRIPT="${E2E_HARNESS_SCRIPT:-$ROOT_DIR/scripts/e2e/harness.sh}"
ENV_FILE="${E2E_RUNTIME_ENV_FILE:-$ROOT_DIR/docs/internal/.e2e-runtime-env}"
COOKIE_JAR_PATH="${E2E_COOKIE_JAR_PATH:-$ROOT_DIR/docs/internal/.e2e-cookiejar}"

REFRESH_ENV=0
KEEP_REPO=0

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

if [[ ! -f "$ENV_FILE" || "$REFRESH_ENV" -eq 1 ]]; then
  bash "$RUNTIME_ENV_SCRIPT" refresh --path "$ENV_FILE"
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

bash "$HARNESS_SCRIPT" auth-check --path "$COOKIE_JAR_PATH"

RUN_ARGS=(run --lane provision-only --path "$COOKIE_JAR_PATH")
if [[ "$KEEP_REPO" -eq 1 ]]; then
  RUN_ARGS+=(--keep-repo)
fi

bash "$HARNESS_SCRIPT" "${RUN_ARGS[@]}"
