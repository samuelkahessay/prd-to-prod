#!/usr/bin/env bash
set -euo pipefail

echo "=== Agentic Pipeline Bootstrap ==="

# Check prerequisites
command -v gh >/dev/null 2>&1 || { echo "ERROR: GitHub CLI (gh) not installed"; exit 1; }
gh aw version >/dev/null 2>&1 || { echo "ERROR: gh-aw not installed. Run: gh extension install github/gh-aw"; exit 1; }

# Create labels
echo "Creating labels..."
for label in "pipeline:0075ca:Pipeline-managed issue" \
             "feature:a2eeef:New feature" \
             "test:7057ff:Test coverage" \
             "infra:fbca04:Infrastructure" \
             "docs:0075ca:Documentation" \
             "bug:d73a4a:Bug fix" \
             "automation:e4e669:Created by automation" \
             "in-progress:d93f0b:Work in progress" \
             "blocked:b60205:Blocked by dependency" \
             "ready:0e8a16:Ready for implementation" \
             "completed:0e8a16:Completed and merged" \
             "report:c5def5:Status report"; do
  IFS=: read -r name color desc <<< "$label"
  gh label create "$name" --color "$color" --description "$desc" --force 2>/dev/null || true
done
echo "Labels created."

# Compile workflows
echo "Compiling gh-aw workflows..."
gh aw compile
echo "Workflows compiled."

# Seed repo-memory branch (prevents first-run artifact error)
echo "Seeding repo-memory branch..."
if ! git ls-remote --heads origin memory/repo-assist | grep -q memory/repo-assist; then
  TEMP_DIR=$(mktemp -d)
  echo '{"initialized": true, "note": "Seeded by bootstrap.sh"}' > "$TEMP_DIR/state.json"
  cd "$TEMP_DIR"
  git init -q && git checkout -q --orphan memory/repo-assist
  git add state.json && git commit -q -m "Seed repo memory"
  git remote add origin "$(gh repo view --json url -q .url).git"
  git push -q origin memory/repo-assist
  cd - > /dev/null
  rm -rf "$TEMP_DIR"
  echo "Repo-memory branch created."
else
  echo "Repo-memory branch already exists, skipping."
fi

# Configure repo settings for pipeline
echo "Configuring repo settings..."
gh api repos/{owner}/{repo} --method PATCH \
  -f squash_merge_commit_message="PR_BODY" \
  -f squash_merge_commit_title="PR_TITLE" \
  --silent 2>/dev/null || true
echo "Squash merge set to use PR body (preserves Closes #N)."

# Configure secrets reminder
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Ensure GitHub Copilot is configured as the AI engine"
echo "   Run: gh aw secrets bootstrap"
echo "2. Push changes: git push"
echo "3. Test the pipeline:"
echo "   - Create an issue with a PRD, then comment /decompose"
echo "   - Or run: gh aw run prd-decomposer"
