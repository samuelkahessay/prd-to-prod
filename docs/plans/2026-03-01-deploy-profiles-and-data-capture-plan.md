# Deploy Profiles + Data Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tech-stack agnostic deploy routing and capture pipeline run data as static JSON for the future landing page visualization.

**Architecture:** Deploy profiles are YAML configs in `.github/deploy-profiles/` that describe each stack's CI/CD requirements. A deploy-router workflow reads `.deploy-profile` in the repo root and dispatches to the correct deployment workflow. Existing workflows become reusable (callable). A capture script harvests GitHub API data for past runs into static JSON.

**Tech Stack:** GitHub Actions (YAML workflows), Bash (capture script), gh CLI (GitHub API)

**IMPORTANT — Compile agentic workflows after updating `prd-decomposer.md` and `repo-assist.md`, then verify the `.lock.yml` diffs before commit.**

---

### Task 1: Create deploy profile directory and configs

**Files:**
- Create: `.github/deploy-profiles/dotnet-azure.yml`
- Create: `.github/deploy-profiles/nextjs-vercel.yml`
- Create: `.github/deploy-profiles/docker-generic.yml`

**Step 1: Create directory**

Run: `mkdir -p .github/deploy-profiles`

**Step 2: Write dotnet-azure profile**

```yaml
# Deploy Profile: .NET on Azure App Service
# Read by prd-decomposer and repo-assist to configure CI/CD for this stack.
stack: dotnet
name: ".NET + Azure App Service"

detect:
  files: ["*.sln", "*.csproj"]

build:
  runtime: dotnet
  runtime_version: "10.0.x"
  restore: "dotnet restore ${solution_file}"
  build: "dotnet build ${solution_file} --no-restore -c Release"
  test: "dotnet test ${solution_file} --no-build -c Release --verbosity normal"
  publish: "dotnet publish ${main_project} --no-build -c Release -o ./publish"

deploy:
  workflow: deploy-azure.yml
  method: "Azure App Service via OIDC"
  secrets:
    - AZURE_CLIENT_ID
    - AZURE_TENANT_ID
    - AZURE_SUBSCRIPTION_ID

ci:
  workflow: dotnet-ci.yml
  name: ".NET CI"
```

**Step 3: Write nextjs-vercel profile**

```yaml
# Deploy Profile: Next.js on Vercel
stack: nextjs
name: "Next.js + Vercel"

detect:
  files: ["package.json", "next.config.*"]

build:
  runtime: node
  runtime_version: "20"
  install: "npm ci"
  build: "npm run build"
  test: "npm test"

deploy:
  workflow: deploy-vercel.yml
  method: "Vercel CLI"
  secrets:
    - VERCEL_TOKEN
    - VERCEL_ORG_ID
    - VERCEL_PROJECT_ID

ci:
  workflow: ci-node.yml
  name: "Node CI"
```

**Step 4: Write docker-generic profile**

```yaml
# Deploy Profile: Docker (Generic Container)
stack: docker
name: "Docker + Container Registry"

detect:
  files: ["Dockerfile"]

build:
  runtime: docker
  build: "docker build -t ${image_name}:${tag} ."
  test: "docker run --rm ${image_name}:${tag} test"

deploy:
  workflow: deploy-docker.yml
  method: "GitHub Container Registry (ghcr.io)"
  secrets: []

ci:
  workflow: ci-docker.yml
  name: "Docker CI"
```

**Step 5: Commit**

```bash
git add .github/deploy-profiles/
git commit -m "feat: add deploy profile configs for dotnet-azure, nextjs-vercel, docker-generic"
```

---

### Task 2: Create `.deploy-profile` pointer

**Files:**
- Create: `.deploy-profile`

**Step 1: Write the pointer file**

File contents (single line, no trailing newline):
```
dotnet-azure
```

**Step 2: Commit**

```bash
git add .deploy-profile
git commit -m "feat: set active deploy profile to dotnet-azure for Run 4"
```

---

### Task 3: Convert `deploy-azure.yml` to reusable workflow

**Files:**
- Modify: `.github/workflows/deploy-azure.yml`

**Step 1: Change trigger from push to workflow_call + workflow_dispatch**

Replace the `on:` block:

Old:
```yaml
on:
  push:
    branches: [main]
```

New:
```yaml
on:
  workflow_call:
  workflow_dispatch:  # manual trigger for testing/debugging
```

The `push` trigger moves to the deploy router (Task 6). Everything else stays the same.

**Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-azure.yml'))"`
Expected: No output (success)

**Step 3: Commit**

```bash
git add .github/workflows/deploy-azure.yml
git commit -m "refactor: convert deploy-azure to reusable workflow (called by deploy-router)"
```

---

### Task 4: Create `deploy-vercel.yml` reusable workflow

**Files:**
- Create: `.github/workflows/deploy-vercel.yml`

**Step 1: Write the workflow**

```yaml
#
# Deploy to Vercel — Builds and deploys a Next.js app to Vercel.
# Called by deploy-router.yml when the active profile is nextjs-vercel.
#
# Prerequisites:
#   - VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID secrets
#   - Vercel project linked to the repo
#

name: Deploy to Vercel

on:
  workflow_call:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: deploy-vercel
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Pull Vercel config
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: vercel pull --yes --environment=production --token=$VERCEL_TOKEN

      - name: Build
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: vercel build --prod --token=$VERCEL_TOKEN

      - name: Deploy
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

**Step 2: Verify YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-vercel.yml'))"`

**Step 3: Commit**

```bash
git add .github/workflows/deploy-vercel.yml
git commit -m "feat: add deploy-vercel reusable workflow for Next.js deployments"
```

---

### Task 5: Create `deploy-docker.yml` reusable workflow

**Files:**
- Create: `.github/workflows/deploy-docker.yml`

**Step 1: Write the workflow**

```yaml
#
# Deploy Docker — Builds a Docker image and pushes to GitHub Container Registry.
# Called by deploy-router.yml when the active profile is docker-generic.
#
# The image is pushed to ghcr.io/<owner>/<repo>:latest and :sha.
# Downstream deployment (Railway, Fly, Azure Container Apps, etc.) can pull
# from GHCR using a webhook or polling strategy.
#

name: Deploy Docker

on:
  workflow_call:
  workflow_dispatch:

permissions:
  contents: read
  packages: write

concurrency:
  group: deploy-docker
  cancel-in-progress: true

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
```

**Step 2: Verify YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-docker.yml'))"`

**Step 3: Commit**

```bash
git add .github/workflows/deploy-docker.yml
git commit -m "feat: add deploy-docker reusable workflow for container deployments"
```

---

### Task 6: Create `deploy-router.yml`

**Files:**
- Create: `.github/workflows/deploy-router.yml`

**Step 1: Write the workflow**

```yaml
#
# Deploy Router — Reads the active deploy profile and dispatches to the
# appropriate deployment workflow on every push to main.
#
# The .deploy-profile file in the repo root contains the profile name
# (e.g., "dotnet-azure", "nextjs-vercel", "docker-generic").
#
# Safety:
#   - Concurrency group ensures only one deploy runs at a time
#   - Fails loudly if .deploy-profile is missing
#   - Fails loudly if profile is unrecognized
#

name: Deploy Router

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write   # needed for Azure OIDC
  packages: write   # needed for Docker GHCR

concurrency:
  group: deploy
  cancel-in-progress: true

jobs:
  detect-profile:
    runs-on: ubuntu-latest
    outputs:
      profile: ${{ steps.read.outputs.profile }}
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: .deploy-profile
          sparse-checkout-cone-mode: false

      - id: read
        run: |
          if [ ! -f .deploy-profile ]; then
            echo "::error::No .deploy-profile found in repo root. Create one with the profile name (e.g., 'dotnet-azure')."
            exit 1
          fi
          PROFILE=$(cat .deploy-profile | tr -d '[:space:]')
          if [ -z "$PROFILE" ]; then
            echo "::error::.deploy-profile is empty."
            exit 1
          fi
          echo "profile=${PROFILE}" >> $GITHUB_OUTPUT
          echo "Deploy profile: ${PROFILE}"

  deploy-azure:
    needs: detect-profile
    if: needs.detect-profile.outputs.profile == 'dotnet-azure'
    uses: ./.github/workflows/deploy-azure.yml
    secrets: inherit

  deploy-vercel:
    needs: detect-profile
    if: needs.detect-profile.outputs.profile == 'nextjs-vercel'
    uses: ./.github/workflows/deploy-vercel.yml
    secrets: inherit

  deploy-docker:
    needs: detect-profile
    if: needs.detect-profile.outputs.profile == 'docker-generic'
    uses: ./.github/workflows/deploy-docker.yml
    secrets: inherit
```

**Step 2: Verify YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-router.yml'))"`

**Step 3: Commit**

```bash
git add .github/workflows/deploy-router.yml
git commit -m "feat: add deploy-router workflow to dispatch based on active profile"
```

---

### Task 7: Add profile guard to `dotnet-ci.yml` and create `ci-node.yml`

**Files:**
- Modify: `.github/workflows/dotnet-ci.yml`
- Create: `.github/workflows/ci-node.yml`

**Step 1: Add profile guard to dotnet-ci.yml**

Replace the entire file with:

```yaml
name: .NET CI

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  check-profile:
    runs-on: ubuntu-latest
    outputs:
      should-run: ${{ steps.check.outputs.should-run }}
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: .deploy-profile
          sparse-checkout-cone-mode: false
      - id: check
        run: |
          PROFILE=$(cat .deploy-profile 2>/dev/null || echo "dotnet-azure")
          if [[ "$PROFILE" == "dotnet-azure" ]]; then
            echo "should-run=true" >> $GITHUB_OUTPUT
          else
            echo "should-run=false" >> $GITHUB_OUTPUT
            echo "Skipping .NET CI — active profile is '${PROFILE}'"
          fi

  build-and-test:
    needs: check-profile
    if: needs.check-profile.outputs.should-run == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'
      - run: dotnet restore TicketDeflection.sln
      - run: dotnet build TicketDeflection.sln --no-restore
      - run: dotnet test TicketDeflection.sln --no-build --verbosity normal
```

**Step 2: Create ci-node.yml**

```yaml
name: Node CI

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  check-profile:
    runs-on: ubuntu-latest
    outputs:
      should-run: ${{ steps.check.outputs.should-run }}
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: .deploy-profile
          sparse-checkout-cone-mode: false
      - id: check
        run: |
          PROFILE=$(cat .deploy-profile 2>/dev/null || echo "dotnet-azure")
          if [[ "$PROFILE" == "nextjs-vercel" ]]; then
            echo "should-run=true" >> $GITHUB_OUTPUT
          else
            echo "should-run=false" >> $GITHUB_OUTPUT
            echo "Skipping Node CI — active profile is '${PROFILE}'"
          fi

  build-and-test:
    needs: check-profile
    if: needs.check-profile.outputs.should-run == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

**Step 3: Verify both files**

Run: `python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/dotnet-ci.yml', '.github/workflows/ci-node.yml']]"`

**Step 4: Commit**

```bash
git add .github/workflows/dotnet-ci.yml .github/workflows/ci-node.yml
git commit -m "feat: add profile-gated CI — dotnet-ci checks profile, new ci-node for Node stacks"
```

---

### Task 8: Update CI Failure Router for new workflow names

**Files:**
- Modify: `.github/workflows/ci-failure-issue.yml`

**Step 1: Update the workflow_run listener**

Find this block (line 18-19):
```yaml
    workflows: [".NET CI", "Deploy to Azure"]
```

Replace with:
```yaml
    workflows: [".NET CI", "Node CI", "Deploy Router", "Deploy to Azure"]
```

Rationale:
- "Deploy Router" replaces "Deploy to Azure" as the primary push-to-main trigger
- "Deploy to Azure" kept for manual `workflow_dispatch` runs
- "Node CI" added for forward compatibility when a Node stack is selected

**Step 2: Commit**

```bash
git add .github/workflows/ci-failure-issue.yml
git commit -m "fix: update CI failure router to listen to Deploy Router and Node CI"
```

---

### Task 9: Update CI Failure Resolve for new workflow names

**Files:**
- Modify: `.github/workflows/ci-failure-resolve.yml`

**Step 1: Read the file to find the workflow_run listener**

The file should have a similar `workflows:` line. Update it to include Node CI:

```yaml
    workflows: [".NET CI", "Node CI"]
```

**Step 2: Commit**

```bash
git add .github/workflows/ci-failure-resolve.yml
git commit -m "fix: update CI failure resolve to also listen to Node CI"
```

---

### Task 10: Update `prd-decomposer.md` with stack awareness

**Files:**
- Modify: `.github/workflows/prd-decomposer.md`

**Step 1: Add Tech Stack Detection section**

After the existing "## Decomposition Rules" section (before "## Output Format"), insert:

```markdown
## Tech Stack Detection

Before creating issues, determine the target tech stack and deploy profile:

1. **Check the PRD for explicit stack preference.** Look for mentions of specific frameworks (Next.js, React, .NET, Express), languages (TypeScript, C#, Python), or deployment targets (Vercel, Azure, Docker).

2. **If no explicit preference**, infer from the requirements:
   - Web dashboard, landing page, interactive UI, visualization → `nextjs-vercel`
   - API service, enterprise backend, .NET/C# → `dotnet-azure`
   - Multi-language, microservices, or unclear → `docker-generic`
   - Default (no clear signals): `nextjs-vercel`

3. **Read the selected deploy profile** from `.github/deploy-profiles/{profile-name}.yml` to understand the build, test, and deploy configuration.

4. **The FIRST issue must be a bootstrap/scaffold issue** that includes in its Technical Notes:
   - The selected deploy profile (e.g., "Deploy profile: `nextjs-vercel`")
   - Instruction: "Update `.deploy-profile` to `{profile-name}`"
   - Build, test, and deploy commands from the profile
```

**Step 2: Update the safe-outputs to include file operations if needed**

No change needed — the decomposer doesn't write files, it creates issues.

**Step 3: Commit and recompile workflow locks**

```bash
git add .github/workflows/prd-decomposer.md
git commit -m "feat: add tech stack detection to prd-decomposer for deploy profile selection"
```

---

### Task 11: Update `repo-assist.md` with deploy profile awareness

**Files:**
- Modify: `.github/workflows/repo-assist.md`

**Step 1: Add Deploy Profile section after "Always:" block in Scheduled Mode**

After the existing "Always:" bullet list (around line 133-137), add:

```markdown
## Deploy Profile

Before implementing issues, read the active deploy profile:
1. Read `.deploy-profile` for the active profile name
2. Read `.github/deploy-profiles/{profile}.yml` for stack-specific build/test/deploy commands
3. Use these commands in place of hardcoded language-specific commands
4. When implementing a bootstrap issue, update `.deploy-profile` to the profile specified in the issue's Technical Notes
```

**Step 2: Commit and recompile workflow locks**

```bash
git add .github/workflows/repo-assist.md
git commit -m "feat: add deploy profile awareness to repo-assist for stack-agnostic CI/CD"
```

---

### Task 12: Create `scripts/capture-run-data.sh`

**Files:**
- Create: `scripts/capture-run-data.sh`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
#
# capture-run-data.sh — Harvests GitHub API data for a pipeline run and writes
# a structured JSON file for the landing page visualization.
#
# Usage:
#   ./scripts/capture-run-data.sh <run-number>
#
# Expects:
#   - gh CLI authenticated
#   - showcase/<run-dir>/manifest.json with run metadata and issue/PR lists
#
# Output:
#   - showcase/<run-dir>/run-data.json
#

set -euo pipefail

REPO="samuelkahessay/prd-to-prod"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <run-number>"
  echo "Example: $0 1"
  exit 1
fi

RUN_NUMBER=$1

# Find the showcase directory for this run
RUN_DIR=$(find showcase -maxdepth 1 -type d -name "$(printf '%02d' "$RUN_NUMBER")-*" | head -1)
if [ -z "$RUN_DIR" ]; then
  echo "Error: No showcase directory found for run ${RUN_NUMBER}"
  echo "Expected: showcase/$(printf '%02d' "$RUN_NUMBER")-*/"
  exit 1
fi

MANIFEST="${RUN_DIR}/manifest.json"
OUTPUT="${RUN_DIR}/run-data.json"

if [ ! -f "$MANIFEST" ]; then
  echo "Error: No manifest.json found at ${MANIFEST}"
  echo "Create one with run metadata, issue numbers, and PR numbers."
  exit 1
fi

echo "Capturing run data for Run ${RUN_NUMBER} from ${RUN_DIR}..."

# Read manifest
RUN_META=$(jq -c '.run' "$MANIFEST")
ISSUE_NUMBERS=$(jq -r '.issues[]' "$MANIFEST")
PR_NUMBERS=$(jq -r '.pull_requests[]' "$MANIFEST")

# Fetch issues
echo "Fetching issues..."
ISSUES="[]"
for NUM in $ISSUE_NUMBERS; do
  echo "  Issue #${NUM}"
  ISSUE_JSON=$(gh api "repos/${REPO}/issues/${NUM}" --jq '{
    number: .number,
    title: .title,
    body: .body,
    state: .state,
    labels: [.labels[].name],
    created_at: .created_at,
    closed_at: .closed_at,
    user: .user.login
  }' 2>/dev/null || echo '{"number": '$NUM', "error": "not found"}')
  ISSUES=$(printf '%s' "$ISSUES" | jq --argjson item "$ISSUE_JSON" '. + [$item]')
  sleep 0.2  # Rate limit courtesy
done

# Fetch PRs with reviews and file stats
echo "Fetching pull requests..."
PRS="[]"
for NUM in $PR_NUMBERS; do
  echo "  PR #${NUM}"

  # PR metadata
  PR_JSON=$(gh api "repos/${REPO}/pulls/${NUM}" --jq '{
    number: .number,
    title: .title,
    body: .body,
    state: .state,
    merged_at: .merged_at,
    created_at: .created_at,
    additions: .additions,
    deletions: .deletions,
    changed_files: .changed_files,
    user: .user.login,
    head_branch: .head.ref,
    base_branch: .base.ref
  }' 2>/dev/null || echo '{"number": '$NUM', "error": "not found"}')

  # Reviews
  REVIEWS=$(gh api "repos/${REPO}/pulls/${NUM}/reviews" --jq '[.[] | {
    user: .user.login,
    state: .state,
    body: (.body // "" | .[0:500]),
    submitted_at: .submitted_at
  }]' 2>/dev/null || echo '[]')

  # Changed files
  FILES=$(gh api "repos/${REPO}/pulls/${NUM}/files" --jq '[.[] | {
    filename: .filename,
    status: .status,
    additions: .additions,
    deletions: .deletions
  }]' 2>/dev/null || echo '[]')

  # Combine
  COMBINED=$(printf '%s' "$PR_JSON" | jq \
    --argjson reviews "$REVIEWS" \
    --argjson files "$FILES" \
    '. + {reviews: $reviews, files: $files}')

  PRS=$(printf '%s' "$PRS" | jq --argjson item "$COMBINED" '. + [$item]')
  sleep 0.3  # Rate limit courtesy
done

# Build timeline from issues and PRs
echo "Building timeline..."
TIMELINE="[]"

# Issue creation events
for ISSUE in $(printf '%s' "$ISSUES" | jq -c '.[]'); do
  NUM=$(printf '%s' "$ISSUE" | jq -r '.number')
  TITLE=$(printf '%s' "$ISSUE" | jq -r '.title')
  CREATED=$(printf '%s' "$ISSUE" | jq -r '.created_at')
  if [ "$CREATED" != "null" ]; then
    EVENT=$(jq -n --arg ts "$CREATED" --arg title "$TITLE" --argjson num "$NUM" \
      '{timestamp: $ts, event: "issue_created", item: $num, title: $title}')
    TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
  fi
done

# PR creation, review, and merge events
for PR in $(printf '%s' "$PRS" | jq -c '.[]'); do
  NUM=$(printf '%s' "$PR" | jq -r '.number')
  TITLE=$(printf '%s' "$PR" | jq -r '.title')
  CREATED=$(printf '%s' "$PR" | jq -r '.created_at')
  MERGED=$(printf '%s' "$PR" | jq -r '.merged_at')

  if [ "$CREATED" != "null" ]; then
    EVENT=$(jq -n --arg ts "$CREATED" --arg title "$TITLE" --argjson num "$NUM" \
      '{timestamp: $ts, event: "pr_opened", item: $num, title: $title}')
    TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
  fi

  # Review events
  for REVIEW in $(printf '%s' "$PR" | jq -c '.reviews[]? // empty'); do
    REVIEW_TS=$(printf '%s' "$REVIEW" | jq -r '.submitted_at')
    REVIEW_STATE=$(printf '%s' "$REVIEW" | jq -r '.state')
    if [ "$REVIEW_TS" != "null" ]; then
      EVENT=$(jq -n --arg ts "$REVIEW_TS" --arg state "$REVIEW_STATE" --argjson num "$NUM" --arg title "$TITLE" \
        '{timestamp: $ts, event: ("review_" + ($state | ascii_downcase)), item: $num, title: $title}')
      TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
    fi
  done

  if [ "$MERGED" != "null" ]; then
    EVENT=$(jq -n --arg ts "$MERGED" --arg title "$TITLE" --argjson num "$NUM" \
      '{timestamp: $ts, event: "pr_merged", item: $num, title: $title}')
    TIMELINE=$(printf '%s' "$TIMELINE" | jq --argjson e "$EVENT" '. + [$e]')
  fi
done

# Sort timeline by timestamp
TIMELINE=$(printf '%s' "$TIMELINE" | jq 'sort_by(.timestamp)')

# Compute stats
ISSUES_COUNT=$(printf '%s' "$ISSUES" | jq 'length')
PRS_COUNT=$(printf '%s' "$PRS" | jq 'length')
PRS_MERGED=$(printf '%s' "$PRS" | jq '[.[] | select(.merged_at != null)] | length')
TOTAL_ADDITIONS=$(printf '%s' "$PRS" | jq '[.[].additions // 0] | add // 0')
TOTAL_DELETIONS=$(printf '%s' "$PRS" | jq '[.[].deletions // 0] | add // 0')
TOTAL_FILES=$(printf '%s' "$PRS" | jq '[.[].changed_files // 0] | add // 0')

STATS=$(jq -n \
  --argjson issues "$ISSUES_COUNT" \
  --argjson prs "$PRS_COUNT" \
  --argjson merged "$PRS_MERGED" \
  --argjson additions "$TOTAL_ADDITIONS" \
  --argjson deletions "$TOTAL_DELETIONS" \
  --argjson files "$TOTAL_FILES" \
  '{
    issues_created: $issues,
    prs_total: $prs,
    prs_merged: $merged,
    lines_added: $additions,
    lines_removed: $deletions,
    files_changed: $files
  }')

# Assemble final output
echo "Writing ${OUTPUT}..."
jq -n \
  --argjson run "$RUN_META" \
  --argjson stats "$STATS" \
  --argjson issues "$ISSUES" \
  --argjson prs "$PRS" \
  --argjson timeline "$TIMELINE" \
  '{
    run: $run,
    stats: $stats,
    issues: $issues,
    pull_requests: $prs,
    timeline: $timeline
  }' > "$OUTPUT"

echo "Done. Captured $(printf '%s' "$ISSUES" | jq 'length') issues, $(printf '%s' "$PRS" | jq 'length') PRs, $(printf '%s' "$TIMELINE" | jq 'length') timeline events."
echo "Output: ${OUTPUT}"
```

**Step 2: Make executable**

Run: `chmod +x scripts/capture-run-data.sh`

**Step 3: Commit**

```bash
git add scripts/capture-run-data.sh
git commit -m "feat: add capture-run-data script to harvest GitHub API data for pipeline visualization"
```

---

### Task 13: Create run manifests for all 4 runs

**Files:**
- Create: `showcase/01-code-snippet-manager/manifest.json`
- Create: `showcase/02-pipeline-observatory/manifest.json`
- Create: `showcase/03-devcard/manifest.json`
- Create: `showcase/04-ticket-deflection/manifest.json` (also creates directory)

**Step 1: Create Run 1 manifest**

```json
{
  "run": {
    "number": 1,
    "name": "Code Snippet Manager",
    "tag": "v1.0.0",
    "tech_stack": "Express + TypeScript",
    "date": "2026-02",
    "deployment": null,
    "prd": "docs/prd/sample-prd.md"
  },
  "issues": [7, 8, 9, 10, 11, 12, 13, 14],
  "pull_requests": [16, 17, 18, 20, 21, 26, 27]
}
```

**Step 2: Create Run 2 manifest**

Issue and PR numbers from showcase/02 README:

```json
{
  "run": {
    "number": 2,
    "name": "Pipeline Observatory",
    "tag": "v2.0.0",
    "tech_stack": "Next.js 14 + TypeScript",
    "date": "2026-02",
    "deployment": "https://prdtoprod.vercel.app",
    "prd": "docs/prd/pipeline-observatory-prd.md"
  },
  "issues": [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41],
  "pull_requests": [40, 42, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58]
}
```

Note: Run 2 issue numbers (29-41) are approximate — they need to be verified by querying the API. The PRs are from the showcase README.

**Step 3: Create Run 3 manifest**

```json
{
  "run": {
    "number": 3,
    "name": "DevCard",
    "tag": "v3.0.0",
    "tech_stack": "Next.js 14 + TypeScript + Framer Motion",
    "date": "2026-02",
    "deployment": "https://prdtoprod.vercel.app",
    "prd": "docs/prd/devcard-prd.md"
  },
  "issues": [63, 64, 65, 66, 67, 68, 69, 70, 71, 73, 89, 90, 91, 101, 102, 103, 104],
  "pull_requests": []
}
```

Note: Run 3 PRs need to be discovered — the showcase lists issues but not all PRs. Use `gh api` to find PRs that close these issues.

**Step 4: Create Run 4 manifest**

Run: `mkdir -p showcase/04-ticket-deflection`

Run 4 issue/PR numbers need to be discovered from the API. Query for issues/PRs between v3.0.0 and v4.0.0 tags.

```json
{
  "run": {
    "number": 4,
    "name": "Ticket Deflection",
    "tag": "v4.0.0",
    "tech_stack": "ASP.NET Core 8 + C#",
    "date": "2026-02",
    "deployment": "https://prd-to-prod.azurewebsites.net",
    "prd": "docs/prd/ticket-deflection-prd.md"
  },
  "issues": [],
  "pull_requests": []
}
```

Note: Issues and PRs need to be populated via API discovery. Run the following to find them:

```bash
# Find all merged [Pipeline] PRs
gh pr list --repo samuelkahessay/prd-to-prod --state merged --limit 100 --json number,title,mergedAt,body \
  | jq '[.[] | select(.title | startswith("[Pipeline]"))] | sort_by(.mergedAt)'

# Cross-reference with tag dates to group by run
```

**Step 5: Commit manifests**

```bash
git add showcase/*/manifest.json
git commit -m "feat: add run manifests for data capture (runs 1-4)"
```

---

### Task 14: Discover missing issue/PR numbers and update manifests

**Step 1: Query API for Run 2 issues**

```bash
# Get v1.0.0 and v2.0.0 tag dates
V1_DATE=$(gh api repos/samuelkahessay/prd-to-prod/git/commits/2990f95354fc9d949a96c9bac69d32a78d9ab847 --jq '.committer.date')
V2_DATE=$(gh api repos/samuelkahessay/prd-to-prod/git/commits/88c119fbdae71d2020080cac803a6710b2ab184b --jq '.committer.date')

# Find pipeline issues created between v1 and v2
gh api "repos/samuelkahessay/prd-to-prod/issues?state=all&labels=pipeline&per_page=100&since=${V1_DATE}" \
  --jq "[.[] | select(.created_at <= \"${V2_DATE}\")] | [.[].number] | sort"
```

**Step 2: Query API for Run 3 PRs**

```bash
# Find PRs that close Run 3 issues
gh pr list --repo samuelkahessay/prd-to-prod --state merged --limit 100 --json number,body \
  | jq '[.[] | select(.body | test("(?i)closes? #(63|64|65|66|67|68|69|70|71|73|89|90|91|101|102|103|104)"))] | [.[].number] | sort'
```

**Step 3: Query API for Run 4 issues and PRs**

```bash
V3_DATE=$(gh api repos/samuelkahessay/prd-to-prod/git/commits/cc4e09da9036cc874d4f7a5e9e71dbcc39c73a19 --jq '.committer.date')
V4_DATE=$(gh api repos/samuelkahessay/prd-to-prod/git/commits/00c140aa1d9118580af295f5f8b6a06c46529d39 --jq '.committer.date')

# Issues between v3 and v4
gh api "repos/samuelkahessay/prd-to-prod/issues?state=all&labels=pipeline&per_page=100&since=${V3_DATE}" \
  --jq "[.[] | select(.created_at <= \"${V4_DATE}\")] | [.[].number] | sort"

# PRs between v3 and v4
gh pr list --repo samuelkahessay/prd-to-prod --state merged --limit 100 --json number,title,mergedAt \
  | jq --arg start "$V3_DATE" --arg end "$V4_DATE" \
    '[.[] | select(.title | startswith("[Pipeline]")) | select(.mergedAt >= $start and .mergedAt <= $end)] | [.[].number] | sort'
```

**Step 4: Update manifests with discovered numbers**

Edit each `manifest.json` to include the correct issue and PR lists.

**Step 5: Commit updated manifests**

```bash
git add showcase/*/manifest.json
git commit -m "fix: populate manifest issue/PR numbers from GitHub API"
```

---

### Task 15: Run data capture for all 4 runs

**Step 1: Run capture for each run**

```bash
./scripts/capture-run-data.sh 1
./scripts/capture-run-data.sh 2
./scripts/capture-run-data.sh 3
./scripts/capture-run-data.sh 4
```

**Step 2: Validate output**

For each run:
```bash
# Check JSON is valid and has expected structure
jq '.run.name, .stats.issues_created, .stats.prs_merged, (.timeline | length)' showcase/01-code-snippet-manager/run-data.json
jq '.run.name, .stats.issues_created, .stats.prs_merged, (.timeline | length)' showcase/02-pipeline-observatory/run-data.json
jq '.run.name, .stats.issues_created, .stats.prs_merged, (.timeline | length)' showcase/03-devcard/run-data.json
jq '.run.name, .stats.issues_created, .stats.prs_merged, (.timeline | length)' showcase/04-ticket-deflection/run-data.json
```

Expected: Each file should have non-zero stats and a populated timeline.

**Step 3: Commit captured data**

```bash
git add showcase/*/run-data.json
git commit -m "feat: capture pipeline run data for runs 1-4 (static JSON for visualization)"
```

---

### Task 16: Final validation and summary commit

**Step 1: Verify all new files exist**

```bash
ls -la .deploy-profile
ls -la .github/deploy-profiles/
ls -la .github/workflows/deploy-router.yml
ls -la .github/workflows/deploy-vercel.yml
ls -la .github/workflows/deploy-docker.yml
ls -la .github/workflows/ci-node.yml
ls -la scripts/capture-run-data.sh
ls -la showcase/*/manifest.json
ls -la showcase/*/run-data.json
```

**Step 2: Verify YAML syntax for all workflow files**

```bash
python3 -c "
import yaml, glob
for f in glob.glob('.github/workflows/*.yml'):
    try:
        yaml.safe_load(open(f))
        print(f'OK: {f}')
    except Exception as e:
        print(f'FAIL: {f} — {e}')
"
```

Expected: All files OK.

**Step 3: Verify JSON syntax for all data files**

```bash
for f in showcase/*/run-data.json showcase/*/manifest.json; do
  jq empty "$f" && echo "OK: $f" || echo "FAIL: $f"
done
```

Expected: All files OK.

**Step 4: Check git status**

```bash
git status
git log --oneline feat/deploy-profiles-and-data-capture ^main
```

Expected: Clean working directory, series of focused commits.

---

## Post-Implementation (User Must Do)

1. **Compile agentic workflows**: `gh aw compile` — verify `.lock.yml` diffs look correct
2. **Push branch**: `git push -u origin feat/deploy-profiles-and-data-capture`
3. **Create PR or merge**: These are infrastructure changes (CLAUDE.md exception) — can merge directly
4. **Verify deploy**: After merge, the Deploy Router should fire and dispatch to deploy-azure
5. **Set up secrets**: If Vercel or Docker deploys are needed, add the required secrets to the repo
