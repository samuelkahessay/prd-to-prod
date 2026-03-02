#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: healing-control.sh is-enabled" >&2
  exit 2
}

[ "$#" -eq 1 ] || usage

case "$1" in
  is-enabled)
    RAW_VALUE="${PIPELINE_HEALING_ENABLED:-}"
    NORMALIZED_VALUE=$(printf '%s' "$RAW_VALUE" | tr '[:upper:]' '[:lower:]')

    case "$NORMALIZED_VALUE" in
      "")
        exit 0
        ;;
      true)
        exit 0
        ;;
      false)
        exit 1
        ;;
      *)
        echo "Invalid PIPELINE_HEALING_ENABLED value '${RAW_VALUE}'; expected true or false. Treating as disabled." >&2
        exit 1
        ;;
    esac
    ;;
  *)
    usage
    ;;
esac
