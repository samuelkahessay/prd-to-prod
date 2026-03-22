#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/pre-e2e-gate.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/bin"
LOG_FILE="$TMPDIR/calls.log"
: > "$LOG_FILE"
export LOG_FILE

ln -s "$ROOT_DIR/console" "$TMPDIR/console"
ln -s "$ROOT_DIR/studio" "$TMPDIR/studio"

cat > "$TMPDIR/.deploy-profile" <<'EOF'
nextjs-vercel
EOF

cat > "$TMPDIR/bin/git" <<'EOF'
#!/bin/bash
printf 'git %s\n' "$*" >> "$LOG_FILE"
case "$1" in
  -C)
    shift 2
    ;;
esac

case "$1" in
  rev-parse)
    echo "main"
    exit 0
    ;;
  status)
    exit 0
    ;;
esac

exit 0
EOF

cat > "$TMPDIR/bin/gh" <<'EOF'
#!/bin/bash
printf 'gh %s\n' "$*" >> "$LOG_FILE"

if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  exit 0
fi

if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi

if [ "$1" = "aw" ] && [ "$2" = "version" ]; then
  echo "gh-aw version 0.0.0"
  exit 0
fi

if [ "$1" = "api" ] && [ "$2" = "/status" ]; then
  echo '{"status":"ok"}'
  exit 0
fi

if [ "$1" = "repo" ] && [ "$2" = "view" ]; then
  echo "true"
  exit 0
fi

if [ "$1" = "api" ] && [[ "$2" == *"studio/package.json"* ]]; then
  echo "package.json"
  exit 0
fi

if [ "$1" = "api" ] && [[ "$2" == *"studio/next.config.ts"* ]]; then
  echo "next.config.ts"
  exit 0
fi

if [ "$1" = "api" ] && [[ "$2" == *".deploy-profile"* ]]; then
  printf 'bmV4dGpzLXZlcmNlbAo='
  exit 0
fi

if [ "$1" = "run" ] && [ "$2" = "list" ]; then
  echo '[{"conclusion":"success"}]'
  exit 0
fi

exit 0
EOF

cat > "$TMPDIR/bin/npm" <<'EOF'
#!/bin/bash
printf 'npm %s\n' "$*" >> "$LOG_FILE"
exit 0
EOF

cat > "$TMPDIR/bin/bash" <<'EOF'
#!/bin/bash
printf 'bash %s\n' "$*" >> "$LOG_FILE"
exit 0
EOF

cat > "$TMPDIR/bin/curl" <<'EOF'
#!/bin/bash
printf 'curl %s\n' "$*" >> "$LOG_FILE"
if printf '%s\n' "$*" | grep -q "githubstatus.com"; then
  cat <<JSON
{"components":[{"name":"Actions","status":"operational"}]}
JSON
  exit 0
fi

if printf '%s\n' "$*" | grep -q "prd-to-prod.fly.dev/healthz"; then
  cat <<JSON
{"status":"ok"}
JSON
  exit 0
fi

if printf '%s\n' "$*" | grep -q "https://prdtoprod.com"; then
  printf '200'
  exit 0
fi

exit 0
EOF

cat > "$TMPDIR/bin/fly" <<'EOF'
#!/bin/bash
printf 'fly %s\n' "$*" >> "$LOG_FILE"
if printf '%s\n' "$*" | grep -q "COPILOT_GITHUB_TOKEN"; then
  printf 'github_pat_live_token'
  exit 0
fi
if printf '%s\n' "$*" | grep -q "GH_AW_GITHUB_TOKEN"; then
  printf 'ghp_live_token'
  exit 0
fi
if printf '%s\n' "$*" | grep -q "PIPELINE_APP_ID"; then
  printf '12345'
  exit 0
fi
if printf '%s\n' "$*" | grep -q "PIPELINE_APP_PRIVATE_KEY"; then
  printf 'private-key'
  exit 0
fi
exit 0
EOF

chmod +x \
  "$TMPDIR/bin/git" \
  "$TMPDIR/bin/gh" \
  "$TMPDIR/bin/npm" \
  "$TMPDIR/bin/bash" \
  "$TMPDIR/bin/curl" \
  "$TMPDIR/bin/fly"

export OPENROUTER_API_KEY="or-key"
export COPILOT_GITHUB_TOKEN="github_pat_local_token"
export GH_AW_GITHUB_TOKEN="ghp_local_token"
export PIPELINE_APP_ID="12345"
export PIPELINE_APP_PRIVATE_KEY="private-key"

run_and_capture() {
  : > "$LOG_FILE"
  REPO_ROOT="$TMPDIR" PATH="$TMPDIR/bin:$PATH" /bin/bash "$SCRIPT" "$@" 2>&1 || true
}

OUTPUT_SKIP=$(run_and_capture --skip-live)

if ! printf '%s\n' "$OUTPUT_SKIP" | grep -qF "Local: console preflight required checks pass"; then
  echo "FAIL: expected local preflight check in output" >&2
  exit 1
fi

if ! printf '%s\n' "$OUTPUT_SKIP" | grep -qF "App: console Jest"; then
  echo "FAIL: expected app test check in output" >&2
  exit 1
fi

if printf '%s\n' "$OUTPUT_SKIP" | grep -qF "Live:"; then
  echo "FAIL: --skip-live should suppress live checks" >&2
  exit 1
fi

OUTPUT_LIVE=$(run_and_capture)

if ! printf '%s\n' "$OUTPUT_LIVE" | grep -qF "Live: Fly runtime Copilot token is fine-grained"; then
  echo "FAIL: expected Fly runtime token check in live mode" >&2
  exit 1
fi

if ! printf '%s\n' "$OUTPUT_LIVE" | grep -qF "Live: Fly runtime pipeline app id exists"; then
  echo "FAIL: expected Fly runtime pipeline app id check in live mode" >&2
  exit 1
fi

if ! printf '%s\n' "$OUTPUT_LIVE" | grep -qF "PASS ("; then
  echo "FAIL: expected PASS summary from gate" >&2
  exit 1
fi

unset GH_AW_GITHUB_TOKEN
unset PIPELINE_APP_ID
unset PIPELINE_APP_PRIVATE_KEY

OUTPUT_REMOTE=$(run_and_capture --remote-harness)

if ! printf '%s\n' "$OUTPUT_REMOTE" | grep -qF "Remote harness mode validates this against the deployed runtime"; then
  echo "FAIL: expected remote-harness mode to relax local platform secret checks" >&2
  exit 1
fi

if ! printf '%s\n' "$OUTPUT_REMOTE" | grep -qF "PASS ("; then
  echo "FAIL: expected PASS summary from remote-harness gate" >&2
  exit 1
fi

echo "pre-e2e-gate.sh tests passed"
