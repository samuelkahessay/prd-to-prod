# Architecture Planning Pipeline — Design Document

**Date:** 2026-03-03
**Status:** Approved
**Author:** Samuel Kahessay + Claude

## Context

prd-to-prod's current pipeline flow is: PRD → prd-decomposer → issues → repo-assist → PR → review → merge. The gap is between PRD intake and decomposition — there is no structured architecture planning step. The decomposer creates issues from PRD requirements using heuristics (infrastructure first, features second, tests last), but no agent explicitly decides *what architecture* should support the PRD before work begins.

WSPass (a competing submission for the Wealthsimple AI Builder program) demonstrated genuine depth in this area: a multi-step planner that produces a structured `architecture_pack.json` with requirements, entities, components, tradeoffs, and decomposition order. Their planning agents are real orchestrations (509-line planner, 4,144-line LLM client) — not wrappers.

This design brings that planning depth into prd-to-prod, implemented natively in gh-aw rather than via external Anthropic API calls.

## Goal

Add an architecture planning layer between PRD intake and decomposition that:

1. Produces a structured architecture artifact from the PRD
2. Includes a human review gate before decomposition begins
3. Informs downstream agents (decomposer, repo-assist) with explicit architectural context
4. Works within existing gh-aw infrastructure — no external API dependencies
5. Is backward compatible — pipeline still works without it for simple PRDs

## Design

### New Agent: prd-planner

**File:** `.github/workflows/prd-planner.md` (compiles to `.lock.yml`)

**Role:** Senior Technical Architect — reads a PRD and produces a structured architecture plan.

**Trigger:** `/plan` command on a PRD issue, or automatically before `/decompose`.

**Flow:**

```
User posts PRD issue → /plan command
  ↓
prd-planner reads:
  - PRD text (issue body)
  - Deploy profile (.deploy-profile + profile YAML)
  - Existing codebase (if enhancement, not greenfield)
  - autonomy-policy.yml (to understand boundaries)
  ↓
Produces:
  1. Human-readable architecture comment on the PRD issue
  2. Structured JSON artifact → repo-memory branch
  ↓
Adds label: architecture-draft
  ↓
WAITS — human reviews architecture comment
  ↓
Human types /approve-architecture
  ↓
Label changes: architecture-draft → architecture-approved
  ↓
Dispatches prd-decomposer (reads JSON artifact from repo-memory)
```

### Architecture Artifact Schema (v1.0)

Stored in repo-memory as `architecture/<issue-number>.json`:

```json
{
  "schema_version": "1.0",
  "prd_source": "#350",
  "created_at": "2026-03-03T...",

  "summary": "One-paragraph description of the architecture approach.",

  "tech_stack": {
    "profile": "dotnet-azure",
    "language": "C# 10",
    "framework": "ASP.NET Core Minimal APIs",
    "storage": "EF Core InMemory",
    "deployment": "Azure App Service"
  },

  "requirements": [
    {
      "id": "REQ-001",
      "text": "Scan code/diffs/logs for PIPEDA violations",
      "priority": "must",
      "acceptance_criteria": ["SIN detection with regex", "Credit card Luhn pattern"]
    }
  ],

  "entities": [
    {
      "name": "ComplianceScan",
      "fields": ["Id", "SubmittedAt", "Content", "ContentType", "Disposition"],
      "relationships": ["has many ComplianceFindings"]
    }
  ],

  "components": [
    {
      "name": "ComplianceRuleLibrary",
      "type": "service",
      "responsibility": "Static rule definitions with regex patterns",
      "file_hint": "Services/ComplianceRuleLibrary.cs"
    }
  ],

  "decomposition_order": [
    "domain-models",
    "db-context-and-seed",
    "rule-library",
    "scan-service",
    "api-endpoints",
    "ui-page",
    "tests"
  ],

  "patterns": [
    {
      "name": "Three-disposition classification",
      "description": "AUTO_BLOCK (no override), HUMAN_REQUIRED (operator decides), ADVISORY (informational)"
    }
  ],

  "risks": [
    {
      "description": "Regex rules produce false positives on non-sensitive data",
      "mitigation": "Use HUMAN_REQUIRED disposition for ambiguous patterns"
    }
  ],

  "nfrs": {
    "scale": "single-tenant demo",
    "data_sensitivity": "high",
    "audit_required": true
  }
}
```

### Human-Readable Comment Format

Posted on the PRD issue by prd-planner:

```markdown
## Architecture Plan

**Profile:** dotnet-azure | **Language:** C# 10 | **Framework:** ASP.NET Core

### Summary
<1-paragraph approach description>

### Components
| Component | Type | Responsibility |
|-----------|------|----------------|
| ComplianceRuleLibrary | service | Static rule definitions |
| ComplianceScanService | service | Scan orchestrator |
| ComplianceEndpoints | api | REST surface |

### Data Model
- ComplianceScan → has many ComplianceFindings
- ComplianceFinding → belongs to ComplianceScan

### Decomposition Order
1. Domain models and enums
2. DbContext and seed data
3. Rule library service
4. Scan engine service
5. API endpoints
6. UI page
7. Tests

### Patterns
- Three-disposition classification: AUTO_BLOCK / HUMAN_REQUIRED / ADVISORY

### Risks
- Regex rules may produce false positives → mitigate with HUMAN_REQUIRED disposition

---

*To approve this architecture and begin decomposition, comment `/approve-architecture`.*
*To request changes, reply with feedback and the planner will revise.*
```

### Downstream Integration

#### prd-decomposer changes

When prd-decomposer runs, it checks repo-memory for `architecture/<issue-number>.json`. If found:

1. Uses `decomposition_order` to sequence issue creation (replaces heuristic ordering)
2. References `components` in each issue's Technical Notes (tells repo-assist which files to create)
3. References `patterns` in acceptance criteria (ensures consistency)
4. Adds `file_hint` from components to guide implementation

If no artifact exists, decomposer falls back to current behavior. **Backward compatible.**

#### repo-assist changes

When repo-assist picks up an issue, it checks repo-memory for the architecture artifact linked to the issue's PRD source. If found:

1. Reads `tech_stack` for build environment context
2. Reads `components` to understand overall system shape
3. Reads `patterns` for established conventions
4. Reads `entities` for data model context
5. Cross-references acceptance criteria against architecture requirements

If no artifact exists, repo-assist falls back to current behavior. **Backward compatible.**

### Autonomy Policy Addition

```yaml
- action: architecture_planning
  default_mode: autonomous
  description: "Generate architecture plan from PRD"
  evidence_required: ["architecture artifact in repo-memory"]
```

Planning is autonomous. The human approval gate (`/approve-architecture`) is a separate concern — the agent can plan freely, but decomposition only begins after human approval.

### Approval Gate Workflow

**File:** `.github/workflows/architecture-approve.yml` (standard YAML, not gh-aw)

Listens for `/approve-architecture` comment on issues with `architecture-draft` label:

1. Validates the comment author has write access
2. Swaps label: `architecture-draft` → `architecture-approved`
3. Dispatches prd-decomposer with the issue number

### Agent Configuration

```yaml
# prd-planner.md (gh-aw agent definition)
engine:
  id: copilot
  model: gpt-5

safe-outputs:
  add-comment:
    max: 3
    target: "*"
    hide-older-comments: true
  add-labels:
    allowed: [architecture-draft]
    max: 2

tools:
  bash: true
  github:
    toolsets: [issues]
  repo-memory: true

timeout: 30
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/prd-planner.md` | Create | Planning agent definition |
| `.github/workflows/architecture-approve.yml` | Create | Approval gate workflow |
| `.github/workflows/prd-decomposer.md` | Modify | Read architecture artifact from repo-memory |
| `.github/workflows/repo-assist.md` | Modify | Read architecture artifact from repo-memory |
| `autonomy-policy.yml` | Modify | Add architecture_planning action |
| `scripts/bootstrap.sh` | Modify | Add architecture labels to bootstrap |
| `docs/ARCHITECTURE.md` | Modify | Document the planning layer |

## What This Does NOT Include

- **Refinement chat loop** (WSPass has this; defer until planning agent is proven)
- **Wireframe editor** (WSPass planned this; out of scope)
- **Presentation/storytelling site** (separate workstream — use the planning pipeline to build it)
- **Implementation planning between issues and coding** (can add later if needed)

## Verification

1. Write a test PRD (e.g., "Build a URL shortener")
2. Run `/plan` on the PRD issue
3. Verify: architecture comment posted, `architecture-draft` label added, JSON in repo-memory
4. Comment `/approve-architecture`
5. Verify: label swaps to `architecture-approved`, prd-decomposer dispatched
6. Verify: decomposed issues reference architecture components and follow decomposition order
7. Verify: repo-assist reads architecture artifact when implementing first issue
8. Verify: pipeline still works without planning step (backward compatibility)
