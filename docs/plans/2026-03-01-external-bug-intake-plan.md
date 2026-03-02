# External Bug Intake Implementation Plan

**Goal:** Allow external (non-collaborator) users to file bug reports that the
pipeline picks up and fixes autonomously, without trusting any user-controlled
issue body content.

**Architecture:** A GitHub YAML issue form template auto-assigns `bug` and
`pipeline` labels server-side. `auto-dispatch.yml` continues to dispatch only
actionable `pipeline` issues. Because non-collaborators cannot self-assign
labels on free-form issues, template-filed bugs enter the pipeline while blank
issues remain blocked unless a maintainer intentionally labels them.

**Tech Stack:** GitHub Actions, GitHub Issue Form Templates (YAML)

---

### Task 1: Simplify the Bug Report Issue Template

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/bug-report.yml`

**Context:** The secure gate is the server-applied `pipeline` label, not any
issue body marker. The template should only collect reproduction details and
assign labels.

**Step 1: Remove the unused intake marker field**

The template should keep:

```yaml
name: Bug Report
description: Report a bug in the deployed application
labels: ["bug", "pipeline"]
```

and only collect:

- what happened
- expected behavior
- steps to reproduce
- environment

It should not include a hidden or visible marker field in the body.

**Step 2: Verify file is valid YAML**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/ISSUE_TEMPLATE/bug-report.yml"); puts "Valid YAML"'`
Expected: `Valid YAML`

**Step 3: Commit**

```bash
git add .github/ISSUE_TEMPLATE/bug-report.yml
git commit -m "fix: remove dead intake marker from bug report template"
```

---

### Task 2: Keep Auto-Dispatch on the Label-Based Gate

**Files:**
- Modify: `.github/workflows/auto-dispatch.yml`

**Context:** The current secure model is already label-based. Do not add a body
marker or any other user-editable bypass signal. Instead, make the intent clear
in the workflow.

**Step 1: Add an inline comment describing the security model**

The workflow condition should continue to gate on actionable `pipeline` issues.
Add a short comment near the `if:` condition explaining:

- issue forms apply labels server-side
- non-collaborators cannot self-assign labels on free-form issues
- the `pipeline` label is the trusted dispatch signal

**Step 2: Verify the workflow is valid YAML**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/auto-dispatch.yml"); puts "Valid YAML"'`
Expected: `Valid YAML`

**Step 3: Commit**

```bash
git add .github/workflows/auto-dispatch.yml
git commit -m "docs(auto-dispatch): clarify label-based external intake gate"
```

---

### Task 3: Validate the External Intake Path

**Checks:**

1. Open the GitHub issue creation page and confirm the bug report form is
   available.
2. Confirm a template-filed bug receives `bug` and `pipeline` labels.
3. Confirm `auto-dispatch.yml` runs for that labeled issue.
4. Confirm a blank free-form issue from a non-collaborator does not enter the
   pipeline unless a maintainer adds the labels intentionally.

---

## Acceptance Criteria

1. A structured bug report issue template exists and is selectable when
   creating a new issue.
2. When an issue is created via the bug report template, it automatically
   receives `pipeline` and `bug` labels.
3. An issue created via the bug report template by a non-collaborator triggers
   auto-dispatch through the label gate.
4. Free-form issues from non-collaborators do not gain pipeline access via any
   user-editable body marker.
5. `auto-dispatch.yml` does not rely on issue body content as an authorization
   signal.
