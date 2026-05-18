#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/verify-repo-protection.sh"

[ -x "$SCRIPT" ] || {
  echo "FAIL: scripts/verify-repo-protection.sh must exist and be executable" >&2
  exit 1
}

[ -f "$ROOT_DIR/.github/CODEOWNERS" ] || {
  echo "FAIL: .github/CODEOWNERS is required" >&2
  exit 1
}

grep -F '/.github/workflows/' "$ROOT_DIR/.github/CODEOWNERS" >/dev/null || {
  echo "FAIL: CODEOWNERS must cover workflow changes" >&2
  exit 1
}

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

cat > "$TMPDIR/good.json" <<'JSON'
{
  "repository": {
    "allow_auto_merge": true,
    "allow_squash_merge": true,
    "delete_branch_on_merge": true
  },
  "rulesets": [
    {
      "name": "Protect main",
      "target": "branch",
      "enforcement": "active",
      "bypass_actors": [],
      "rules": [
        {
          "type": "pull_request",
          "parameters": {
            "required_approving_review_count": 1
          }
        },
        {
          "type": "required_status_checks",
          "parameters": {
            "required_status_checks": [
              { "context": "review" },
              { "context": "build-and-test" }
            ]
          }
        }
      ]
    }
  ]
}
JSON

REPO_PROTECTION_FIXTURE="$TMPDIR/good.json" "$SCRIPT" >/dev/null

cat > "$TMPDIR/bad.json" <<'JSON'
{
  "repository": {
    "allow_auto_merge": false,
    "allow_squash_merge": true,
    "delete_branch_on_merge": false
  },
  "rulesets": []
}
JSON

if REPO_PROTECTION_FIXTURE="$TMPDIR/bad.json" "$SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: bad fixture should fail repo protection verification" >&2
  exit 1
fi

cat > "$TMPDIR/bypass.json" <<'JSON'
{
  "repository": {
    "allow_auto_merge": true,
    "allow_squash_merge": true,
    "delete_branch_on_merge": true
  },
  "rulesets": [
    {
      "name": "Protect main",
      "target": "branch",
      "enforcement": "active",
      "bypass_actors": [
        { "actor_type": "Integration", "bypass_mode": "always" }
      ],
      "rules": [
        {
          "type": "pull_request",
          "parameters": {
            "required_approving_review_count": 1
          }
        },
        {
          "type": "required_status_checks",
          "parameters": {
            "required_status_checks": [
              { "context": "review" }
            ]
          }
        }
      ]
    }
  ]
}
JSON

if REPO_PROTECTION_FIXTURE="$TMPDIR/bypass.json" "$SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: bypass actors should fail repo protection verification" >&2
  exit 1
fi

echo "repo protection proof tests passed"
