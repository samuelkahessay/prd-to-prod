#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)

usage() {
  cat >&2 <<'USAGE'
Usage: scripts/scan-sensitive-output.sh <path> [path ...]

Scans generated agent-facing output surfaces for values that must not be
published into PR bodies, comments, workflow prompts, or exported scaffold files.
Secret names such as COPILOT_GITHUB_TOKEN are allowed; concrete token/key values
and private-instance references are not.
USAGE
  exit 2
}

[ "$#" -gt 0 ] || usage

collect_files() {
  local path
  for path in "$@"; do
    if [ -d "$path" ]; then
      find "$path" -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/.next/*" \
        ! -path "*/.git/*" \
        ! -path "*/scripts/scan-sensitive-output.sh" \
        ! -path "scripts/scan-sensitive-output.sh" \
        ! -name "*.png" \
        ! -name "*.jpg" \
        ! -name "*.jpeg" \
        ! -name "*.gif" \
        ! -name "*.ico" \
        ! -name "*.lock" \
        | sort
    elif [ -f "$path" ]; then
      case "$path" in
        */scripts/scan-sensitive-output.sh|scripts/scan-sensitive-output.sh) continue ;;
      esac
      printf '%s\n' "$path"
    else
      echo "WARN: scan path not found: $path" >&2
    fi
  done
}

ERRORS=0
TMP_MATCHES=$(mktemp)
cleanup() {
  rm -f "$TMP_MATCHES"
}
trap cleanup EXIT

private_instance_pattern() {
  local private_title private_lower
  private_title="$(printf '%s%s' "Aur" "rin")"
  private_lower="$(printf '%s%s' "aur" "rin")"

  printf '(^|[^A-Za-z0-9])(%s|%s|%s-platform|%s-app|%s-Ventures)([^A-Za-z0-9]|$)' \
    "$private_title" \
    "$private_lower" \
    "$private_lower" \
    "$private_lower" \
    "$private_title"
}

scan_pattern() {
  local label="$1"
  local pattern="$2"
  shift 2

  : > "$TMP_MATCHES"
  if collect_files "$@" | xargs grep -I -n -E -- "$pattern" > "$TMP_MATCHES" 2>/dev/null; then
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      case "$line" in
        *dummy-byok-key-for-offline-mode*) continue ;;
      esac
      echo "SENSITIVE_OUTPUT: $label: $line" >&2
      ((ERRORS+=1))
    done < "$TMP_MATCHES"
  fi
}

# Product/private instance names must not leak into generated scaffold or agent
# output surfaces. Public marketing pages in core are intentionally not scanned
# by default; callers pass the surfaces they want guarded.
scan_pattern "private-instance-reference" \
  "$(private_instance_pattern)" \
  "$@"

scan_pattern "private-key-material" \
  '-----BEGIN[[:space:]]+([A-Z0-9]+[[:space:]]+)?PRIVATE[[:space:]]+KEY-----' \
  "$@"

scan_pattern "github-token-value" \
  '(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{24,}|github_pat_[A-Za-z0-9_]{30,}' \
  "$@"

scan_pattern "provider-secret-value" \
  '(sk-(or-v1-)?[A-Za-z0-9_-]{24,}|xox[baprs]-[A-Za-z0-9-]{24,})' \
  "$@"

scan_pattern "credential-assignment" \
  '(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY)[[:space:]]*[:=][[:space:]]*["'\'']?[A-Za-z0-9_./+=-]{24,}' \
  "$@"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS sensitive output finding(s) detected" >&2
  exit 1
fi

echo "Sensitive output scan passed"
