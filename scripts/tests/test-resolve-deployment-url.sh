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

URL=$(AZURE_WEBAPP_NAME="my-webapp" bash "$SCRIPT" dotnet-azure)
[ "$URL" = "https://my-webapp.azurewebsites.net" ] || {
  echo "FAIL: Azure webapp name should map to azurewebsites URL" >&2
  exit 1
}

URL=$(bash "$SCRIPT" docker-generic || true)
[ -z "$URL" ] || {
  echo "FAIL: docker-generic should not infer a URL without DEPLOYMENT_URL" >&2
  exit 1
}

echo "resolve-deployment-url tests passed"
