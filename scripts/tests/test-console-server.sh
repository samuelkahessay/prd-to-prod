#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
PORT=43123
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

(
  cd "$ROOT_DIR/console"
  CONSOLE_PORT="$PORT" node server.js >/tmp/prd-to-prod-console-test.log 2>&1
) &
SERVER_PID=$!

for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/runs" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

curl -fsS "http://127.0.0.1:$PORT/api/preflight" | jq -e '.checks | type == "array"' >/dev/null || {
  echo "FAIL: /api/preflight must return a checks array" >&2
  exit 1
}

curl -fsS "http://127.0.0.1:$PORT/api/runs" | jq -e '.runs | type == "array"' >/dev/null || {
  echo "FAIL: /api/runs must return a runs array" >&2
  exit 1
}

STATUS=$(curl -s -o /tmp/prd-to-prod-console-run.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"inputSource":"notes","mode":"new"}' \
  "http://127.0.0.1:$PORT/api/run")

[ "$STATUS" = "400" ] || {
  echo "FAIL: invalid /api/run payload must return 400" >&2
  exit 1
}

jq -e '.error == "notes are required for notes input"' /tmp/prd-to-prod-console-run.json >/dev/null || {
  echo "FAIL: invalid /api/run payload must explain the missing notes input" >&2
  exit 1
}

echo "console server smoke tests passed"
