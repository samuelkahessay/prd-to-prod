#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/e2e/runtime-env.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/bin"
ENV_FILE="$TMPDIR/runtime-env"

cat > "$TMPDIR/bin/fly" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *"OPENAI_API_KEY"*)
    printf 'c2stb3ItdjEtdGVzdA=='
    ;;
  *"PIPELINE_APP_ID"*)
    printf 'MTIzNDU='
    ;;
  *"PIPELINE_APP_PRIVATE_KEY"*)
    printf 'cHJpdmF0ZS1rZXk='
    ;;
  *"BUILD_INTERNAL_SECRET"*)
    printf 'aW50ZXJuYWwtc2VjcmV0'
    ;;
  *)
    exit 1
    ;;
esac
EOF
chmod +x "$TMPDIR/bin/fly"

PATH="$TMPDIR/bin:$PATH" bash "$SCRIPT" refresh --path "$ENV_FILE" --app fake-app --console-url https://console.example.com --web-url https://web.example.com >/dev/null

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: expected env file to be created" >&2
  exit 1
fi

VALUES=$(
  /bin/bash -lc "
    source '$ENV_FILE'
    printf '%s|%s|%s|%s|%s|%s' \
      \"\$E2E_OPENAI_API_KEY\" \
      \"\$PIPELINE_APP_ID\" \
      \"\$PIPELINE_APP_PRIVATE_KEY\" \
      \"\$BUILD_INTERNAL_SECRET\" \
      \"\$E2E_CONSOLE_URL\" \
      \"\$E2E_WEB_URL\"
  "
)

if [[ "$VALUES" != "sk-or-v1-test|12345|private-key|internal-secret|https://console.example.com|https://web.example.com" ]]; then
  echo "FAIL: env file did not round-trip expected values" >&2
  exit 1
fi

echo "runtime-env.sh tests passed"
