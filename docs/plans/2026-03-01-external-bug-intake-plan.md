# External Bug Intake Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow external (non-collaborator) users to file bug reports that the pipeline picks up and fixes autonomously.

**Architecture:** A GitHub YAML issue form template auto-assigns `bug` + `pipeline` labels and embeds a hidden marker in the issue body. The existing `auto-dispatch.yml` author gate is relaxed to accept issues containing that marker, so template-filed bugs from anyone enter the pipeline while free-form issues from non-collaborators are still blocked.

**Tech Stack:** GitHub Actions, GitHub Issue Form Templates (YAML)

---

### Task 1: Create Bug Report Issue Template

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug-report.yml`

**Context:** GitHub supports YAML-based issue form templates that render as structured forms. The `labels` field auto-assigns labels at creation time (on the `issues:opened` event). A hidden `textarea` field with a default value embeds the intake marker in the body without the reporter seeing it.

**Step 1: Create the template file**

```yaml
name: Bug Report
description: Report a bug in the deployed application
labels: ["bug", "pipeline"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug. Please fill out the sections below so the pipeline can reproduce and fix the issue.

  - type: textarea
    id: intake-marker
    attributes:
      label: intake-marker
      value: "<!-- bug-intake-template -->"
    validations:
      required: true

  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: Describe the bug. What did you see?
      placeholder: "When I clicked X, Y happened instead of Z."
    validations:
      required: true

  - type: textarea
    id: expected-behavior
    attributes:
      label: What should have happened?
      description: Describe the correct behavior you expected.
      placeholder: "Clicking X should have done Z."
    validations:
      required: true

  - type: textarea
    id: steps-to-reproduce
    attributes:
      label: Steps to reproduce
      description: Exact steps to trigger the bug. The agent needs these to reproduce it.
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: Environment (optional)
      description: Browser, OS, or any other relevant context.
      placeholder: "Chrome 120, macOS 14.2"
    validations:
      required: false
```

**Step 2: Verify file is valid YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/ISSUE_TEMPLATE/bug-report.yml'))" && echo "Valid YAML"`
Expected: `Valid YAML`

**Step 3: Commit**

```bash
git add .github/ISSUE_TEMPLATE/bug-report.yml
git commit -m "feat: add bug report issue template with intake marker

Structured form auto-assigns bug+pipeline labels and embeds
a hidden marker for auto-dispatch to recognize template-filed issues."
```

---

### Task 2: Relax Author Gate in Auto-Dispatch

**Files:**
- Modify: `.github/workflows/auto-dispatch.yml:22-25`

**Context:** The current author gate (line 22-24) restricts dispatch to OWNER, MEMBER, COLLABORATOR, or `github-actions[bot]`. We add a third condition: the issue body contains the bug-intake-template marker. This allows template-filed bugs from anyone to enter the pipeline.

**Step 1: Edit the author gate condition**

In `.github/workflows/auto-dispatch.yml`, the current condition block at lines 22-25:

```yaml
      (
        contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.issue.author_association) ||
        github.event.issue.user.login == 'github-actions[bot]'
      ) &&
```

Replace with:

```yaml
      (
        contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.issue.author_association) ||
        github.event.issue.user.login == 'github-actions[bot]' ||
        contains(github.event.issue.body, '<!-- bug-intake-template -->')
      ) &&
```

**Step 2: Verify the full `if` condition is still valid YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/auto-dispatch.yml'))" && echo "Valid YAML"`
Expected: `Valid YAML`

**Step 3: Commit**

```bash
git add .github/workflows/auto-dispatch.yml
git commit -m "feat: allow template-filed bug reports to bypass author gate

External reporters using the bug report template embed a hidden
marker that auto-dispatch recognizes, letting their issues enter
the pipeline without collaborator status."
```

---

### Task 3: Push Branch and Create PR

**Step 1: Push the branch**

```bash
git push -u origin feat/external-bug-intake
```

**Step 2: Create the PR**

```bash
gh pr create \
  --title "External bug intake — template + auto-dispatch gate" \
  --body "$(cat <<'EOF'
## Summary
- Adds a structured bug report issue template that auto-assigns `bug` + `pipeline` labels
- Relaxes the auto-dispatch author gate to recognize template-filed issues from non-collaborators
- Enables the L3 demo: external user files a bug → pipeline picks it up → autonomous fix

## How it works
1. Reporter opens a bug via the new template form
2. Template auto-assigns `bug` + `pipeline` labels and embeds a hidden `<!-- bug-intake-template -->` marker
3. `auto-dispatch.yml` sees the marker and bypasses the collaborator-only author gate
4. `repo-assist` picks up the issue and processes it like any other pipeline bug

## What doesn't change
- Collaborator-filed issues work exactly as before
- CI self-healing loop unchanged
- Free-form issues from non-collaborators still blocked (no marker = no dispatch)

## Test plan
- [ ] Template renders correctly on GitHub issue creation page
- [ ] Filing a bug via template auto-assigns `bug` and `pipeline` labels
- [ ] Auto-dispatch fires for a template-filed issue from a non-collaborator
- [ ] Free-form issue from non-collaborator does NOT trigger auto-dispatch
- [ ] Existing self-healing drill still passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance Criteria

1. A structured bug report issue template exists and is selectable when creating a new issue
2. When an issue is created via the bug report template, it automatically receives `pipeline` and `bug` labels
3. An issue created via the bug report template by a non-collaborator triggers auto-dispatch
4. An issue created WITHOUT the template by a non-collaborator does NOT trigger auto-dispatch
5. The existing self-healing flow (CI failure → issue → repair) continues to work unchanged
6. Build passes, deploy succeeds
