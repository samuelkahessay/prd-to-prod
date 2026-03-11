#!/usr/bin/env bash
# validate.sh — Structural validation for generated PRDs
# Sourced by extract-prd.sh; provides validate_prd() function

validate_prd() {
  local prd="$1"
  local errors=0

  if [ ! -f "$prd" ]; then
    echo "FAIL: PRD file not found: $prd"
    return 1
  fi

  grep -q "^# PRD:" "$prd"                || { echo "FAIL: Missing PRD title (expected '# PRD: ...')"; ((errors++)); }
  grep -q "^## Tech Stack" "$prd"          || { echo "FAIL: Missing Tech Stack section"; ((errors++)); }
  grep -q "^## Features" "$prd"            || { echo "FAIL: Missing Features section"; ((errors++)); }
  grep -q "^### Feature 1:" "$prd"         || { echo "FAIL: Missing Feature 1"; ((errors++)); }
  grep -q "^\- \[ \]" "$prd"              || { echo "FAIL: No acceptance criteria checkboxes found"; ((errors++)); }
  grep -q "^## Validation Commands" "$prd" || { echo "FAIL: Missing Validation Commands section"; ((errors++)); }
  grep -q "^## Non-Functional" "$prd"      || { echo "FAIL: Missing Non-Functional Requirements section"; ((errors++)); }
  grep -q "^## Out of Scope" "$prd"        || { echo "FAIL: Missing Out of Scope section"; ((errors++)); }

  # Tech stack guard — reject PRDs with unsupported stacks
  local blocked_stacks=("C#" ".NET" "dotnet" "Django" "Flask" "Rails" "Ruby" "Java" "Spring" "Go " "Golang" "Rust" "PHP" "Laravel")
  local tech_stack_section
  tech_stack_section=$(sed -n '/^## Tech Stack/,/^## /p' "$prd" | head -20)
  for blocked in "${blocked_stacks[@]}"; do
    if echo "$tech_stack_section" | grep -qi "$blocked"; then
      echo "FAIL: Unsupported tech stack detected: '$blocked' — pipeline only supports Node.js/TypeScript"
      ((errors++))
    fi
  done

  if [ "$errors" -gt 0 ]; then
    echo ""
    echo "PRD validation failed with $errors error(s)"
    return 1
  fi

  return 0
}

# Allow direct invocation: validate.sh <prd-file>
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  [ -f "$1" ] || { echo "FAIL: PRD file not found: ${1:-<none>}" >&2; exit 1; }
  validate_prd "$1"
fi
