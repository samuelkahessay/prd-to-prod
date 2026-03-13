#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/resolve-deployment-url.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "RED: $SCRIPT does not exist yet" >&2
  exit 1
fi

URL=$(DEPLOYMENT_URL="https://example.com" bash "$SCRIPT" nextjs-vercel)
[ "$URL" = "https://example.com" ] || {
  echo "FAIL: explicit DEPLOYMENT_URL should win" >&2
  exit 1
}

URL=$(VERCEL_PROJECT_PRODUCTION_URL="app.example.vercel.app" bash "$SCRIPT" nextjs-vercel)
[ "$URL" = "https://app.example.vercel.app" ] || {
  echo "FAIL: Vercel production URL should normalize to https" >&2
  exit 1
}

if bash "$SCRIPT" docker-generic >/dev/null 2>&1; then
  echo "FAIL: unsupported docker-generic profile should fail" >&2
  exit 1
fi

echo "resolve-deployment-url tests passed"
