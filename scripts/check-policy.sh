#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POLICY_FILE="$REPO_ROOT/autonomy-policy.yml"

usage() {
  cat >&2 <<'USAGE'
Usage: check-policy.sh <subcommand>

Subcommands:
  validate    Verify that autonomy-policy.yml exists and is well-formed YAML
USAGE
  exit 2
}

cmd_validate() {
  if [ ! -f "$POLICY_FILE" ]; then
    echo "ERROR: autonomy-policy.yml not found at $POLICY_FILE" >&2
    exit 1
  fi

  # Basic structural check: required top-level keys must be present
  for key in version defaults actions merge_gate healing_pause; do
    if ! grep -qE "^${key}:" "$POLICY_FILE"; then
      echo "ERROR: autonomy-policy.yml is missing required key: $key" >&2
      exit 1
    fi
  done

  echo "OK: autonomy-policy.yml is valid"
}

[ "$#" -ge 1 ] || usage

case "$1" in
  validate) cmd_validate ;;
  *) usage ;;
esac
