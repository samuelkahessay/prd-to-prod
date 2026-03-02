#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/healing-control.sh"

if ! env -u PIPELINE_HEALING_ENABLED "$SCRIPT" is-enabled; then
  echo "FAIL: unset PIPELINE_HEALING_ENABLED should enable healing" >&2
  exit 1
fi

if ! PIPELINE_HEALING_ENABLED=true "$SCRIPT" is-enabled; then
  echo "FAIL: PIPELINE_HEALING_ENABLED=true should enable healing" >&2
  exit 1
fi

if PIPELINE_HEALING_ENABLED=false "$SCRIPT" is-enabled; then
  echo "FAIL: PIPELINE_HEALING_ENABLED=false should disable healing" >&2
  exit 1
fi

INVALID_OUTPUT=$(PIPELINE_HEALING_ENABLED=maybe "$SCRIPT" is-enabled 2>&1 >/dev/null || true)
if [ -z "$INVALID_OUTPUT" ]; then
  echo "FAIL: invalid PIPELINE_HEALING_ENABLED value should emit an error" >&2
  exit 1
fi

if PIPELINE_HEALING_ENABLED=maybe "$SCRIPT" is-enabled >/dev/null 2>&1; then
  echo "FAIL: invalid PIPELINE_HEALING_ENABLED value should disable healing" >&2
  exit 1
fi

echo "healing-control.sh tests passed"
