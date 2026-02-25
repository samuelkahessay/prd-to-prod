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
