#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-}"
[ -n "$PROFILE" ] || { echo "Usage: resolve-deployment-url.sh <profile>" >&2; exit 1; }

normalize_url() {
  local candidate="$1"
  [ -n "$candidate" ] || return 1
  case "$candidate" in
    http://*|https://*) printf '%s\n' "$candidate" ;;
    *) printf 'https://%s\n' "$candidate" ;;
  esac
}

if [ -n "${DEPLOYMENT_URL:-}" ]; then
  normalize_url "$DEPLOYMENT_URL"
  exit 0
fi

case "$PROFILE" in
  nextjs-vercel)
    if [ -n "${VERCEL_PROJECT_PRODUCTION_URL:-}" ]; then
      normalize_url "$VERCEL_PROJECT_PRODUCTION_URL"
    fi
    ;;
  dotnet-azure)
    if [ -n "${AZURE_WEBAPP_URL:-}" ]; then
      normalize_url "$AZURE_WEBAPP_URL"
    elif [ -n "${AZURE_WEBAPP_NAME:-}" ]; then
      printf 'https://%s.azurewebsites.net\n' "$AZURE_WEBAPP_NAME"
    fi
    ;;
  docker-generic)
    # Docker deployments require an explicit DEPLOYMENT_URL from repo vars.
    ;;
  *)
    echo "Unknown deploy profile: $PROFILE" >&2
    exit 1
    ;;
esac
