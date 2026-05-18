#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
PROMPT="$ROOT_DIR/.github/workflows/prd-decomposer.md"

grep -F '## Existing Contracts to Read' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must require an Existing Contracts to Read section" >&2
  exit 1
}

grep -F '## Required Validation' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must require a Required Validation section" >&2
  exit 1
}

grep -F '`AGENTS.md`' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must include AGENTS.md in Existing Contracts to Read" >&2
  exit 1
}

grep -F '`.deploy-profile`' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must include .deploy-profile in Existing Contracts to Read" >&2
  exit 1
}

grep -F '`.github/deploy-profiles/<active-profile>.yml`' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must include the active deploy profile path" >&2
  exit 1
}

grep -F 'bash scripts/validate-implementation.sh' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must require the canonical validator first" >&2
  exit 1
}

grep -F 'Schema and shared-contract completeness cross-check' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must require schema/shared-contract cross-checks" >&2
  exit 1
}

grep -F 'OrderRecord.customer_email' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must include the shared type field anti-pattern example" >&2
  exit 1
}

grep -F 'orders.customer_email' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must include the missing schema column anti-pattern example" >&2
  exit 1
}

grep -F 'before the `create-issue` calls are emitted' "$PROMPT" >/dev/null || {
  echo "FAIL: prd-decomposer must run the cross-check before issue creation" >&2
  exit 1
}

echo "prd-decomposer contract section tests passed"
