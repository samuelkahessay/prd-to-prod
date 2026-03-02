#!/usr/bin/env bash

# Shared helpers for start-run.sh and archive-run.sh so enhancement runs and
# archive cleanup use the same definition of app-owned files.

RUN_LIFECYCLE_EPHEMERAL_DIRS=(
  "src"
  "TicketDeflection"
  "TicketDeflection.Tests"
)

RUN_LIFECYCLE_EPHEMERAL_FILES=(
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "tailwind.config.ts"
  "postcss.config.js"
  "next.config.js"
  "vitest.config.ts"
  "vercel.json"
  "next-env.d.ts"
  "TicketDeflection.sln"
  "Dockerfile"
  "global.json"
)

run_lifecycle_existing_app_paths() {
  local repo_root="${1:?repo root is required}"
  local path

  for path in "${RUN_LIFECYCLE_EPHEMERAL_DIRS[@]}" "${RUN_LIFECYCLE_EPHEMERAL_FILES[@]}"; do
    if [ -e "${repo_root}/${path}" ]; then
      printf '%s\n' "${path}"
    fi
  done
}

run_lifecycle_has_active_app() {
  local repo_root="${1:?repo root is required}"

  if run_lifecycle_existing_app_paths "${repo_root}" | grep -q .; then
    return 0
  fi

  return 1
}

run_lifecycle_existing_report_paths() {
  local repo_root="${1:?repo root is required}"

  if [ ! -d "${repo_root}/drills/reports" ]; then
    return 0
  fi

  find "${repo_root}/drills/reports" -maxdepth 1 -type f -name '*.json' -print | while IFS= read -r path; do
    printf '%s\n' "${path#${repo_root}/}"
  done
}

run_lifecycle_remove_ephemeral_paths() {
  local repo_root="${1:?repo root is required}"
  local path

  while IFS= read -r path; do
    [ -z "${path}" ] && continue
    rm -rf "${repo_root}/${path}"
    printf '%s\n' "${path}"
  done < <(run_lifecycle_existing_app_paths "${repo_root}")

  while IFS= read -r path; do
    [ -z "${path}" ] && continue
    rm -f "${repo_root}/${path}"
    printf '%s\n' "${path}"
  done < <(run_lifecycle_existing_report_paths "${repo_root}")
}
