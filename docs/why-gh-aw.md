# Why gh-aw: Agentic Workflows vs. Standard GitHub Actions

gh-aw (GitHub Agentic Workflows) entered
[technical preview on February 13, 2026](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/).
This document explains why `prd-to-prod` uses it alongside standard GitHub
Actions instead of treating either tool as the whole system.

## What gh-aw actually is

gh-aw is an open-source CLI extension (`gh extension install github/gh-aw`)
built primarily in Go. It was created as a collaboration between GitHub Next,
Microsoft Research, and Azure Core Upstream, and is
[MIT-licensed](https://github.com/github/gh-aw).

The core idea is simple: you write a Markdown workflow with YAML frontmatter and
a natural-language body. `gh aw compile` turns that into a hardened GitHub
Actions workflow that runs an AI coding agent in a containerized environment.

```
.github/workflows/repo-assist.md       ← human-authored workflow spec
        │
        │ gh aw compile
        ▼
.github/workflows/repo-assist.lock.yml ← generated Actions workflow
```

## Supported agents

gh-aw is not tied to one model provider.

| Engine | Secret required |
|---|---|
| GitHub Copilot (default) | `COPILOT_GITHUB_TOKEN` |
| Claude (Anthropic) | `ANTHROPIC_API_KEY` |
| Codex (OpenAI) | `OPENAI_API_KEY` |

This repo currently uses gh-aw for decomposition, implementation, review,
status reporting, diagnostics, code simplification, duplicate detection, and
security/compliance scans.

## Security model

gh-aw takes a defense-in-depth approach, which is one of its strongest design
choices compared to running an LLM directly inside handwritten YAML with broad
permissions:

- read-only by default
- controlled outputs (agents can only create issues, comments, and PRs through approved channels)
- isolated runtime where agents can only use approved tools
- network isolation
- SHA-pinned dependencies in compiled output
- compile-time validation
- support for human approval gates where needed

## The core distinction

GitHub Actions is a deterministic control plane. You define explicit steps and
state transitions. gh-aw is a tool that runs AI agents — they read context, make decisions, and
produce work. It is useful when the job requires reading context, choosing an
approach, and generating work rather than following a fixed script.

```
GitHub Actions: trigger → route → validate → enforce → deploy
gh-aw:          trigger → read context → reason → act → verify
```

The moment a workflow requires judgment, standard Actions becomes awkward. The
moment a workflow becomes a safety boundary, an unconstrained agent becomes the
wrong tool. This repo uses both because they solve different problems.

## How this repo splits the work

The rule is:

**fixed workflows handle routing and safety; gh-aw handles the work that needs judgment.**

### Standard GitHub Actions

These workflows are routing, guard logic, deploy, and state transitions.

| Workflow | Purpose |
|---|---|
| `auto-dispatch.yml` | Entry gate: accepts `pipeline` issues, classifies actionability, debounces, dispatches |
| `auto-dispatch-requeue.yml` | Picks up the next deferred issue |
| `pr-review-submit.yml` | Parses verdicts, enforces the merge gate, arms auto-merge only inside policy |
| `ci-node.yml` | Deterministic CI |
| `deploy-router.yml`, `deploy-vercel.yml` | Deterministic deploy path |
| `ci-failure-issue.yml` | Converts failed CI or deploy runs into repair commands or escalations |
| `ci-failure-resolve.yml` | Marks repair incidents resolved |
| `pipeline-watchdog.yml` | Stall detection, retry, redispatch, and escalation |
| `close-issues.yml` | Deterministic issue cleanup on merge |

These workflows are where policy becomes real. They are the authority layer.

### gh-aw workflows

These workflows do the work that actually requires interpretation and judgment.

| Workflow | Purpose |
|---|---|
| `prd-decomposer.lock.yml` | Turns a PRD into dependency-ordered issues with acceptance criteria |
| `repo-assist.lock.yml` | Implements issues, maintains PRs, handles review feedback, repairs bounded failures |
| `pr-review-agent.lock.yml` | Reviews the full diff against requirements and policy |
| `pipeline-status.lock.yml` | Produces the rolling status issue |
| `ci-doctor.lock.yml` | Diagnoses CI failure patterns |
| `code-simplifier.lock.yml` | Proposes simplifications in recently changed code |
| `duplicate-code-detector.lock.yml` | Finds duplication patterns |
| `security-compliance.lock.yml` | Runs targeted security and compliance analysis |

These workflows operate inside the human-owned control plane. They do not get to
redefine it.

## Why gh-aw makes sense here

### 1. It closes the judgment gap (the space between what automation can decide and what requires interpretation)

CI/CD has long automated build, test, and deploy. It did not automate turning a
natural-language spec into a scoped implementation plan and a concrete PR. gh-aw
fills that gap.

### 2. Natural language becomes an operational interface

In this repo, humans write product intent and acceptance criteria. The AI lane
handles decomposition, implementation, review, and first-line repair inside
policy. That is a meaningful shift in responsibility, not just a faster code
assistant.

### 3. Multiple agents can cooperate without owning the control plane

This is not one chat agent doing everything. Decomposition, implementation,
review, reporting, and diagnostics are split into separate agents with explicit
contracts, while GitHub Actions keeps the routing and safety boundaries
deterministic.

### 4. Deterministic scaffolding is the point

The surrounding Actions layer provides:

- ingress control
- policy enforcement
- identity separation
- deploy routing
- incident state
- stall recovery

That scaffolding is what turns agentic work into a bounded system instead of a
demo.

## When gh-aw fits better than standard Actions

| Scenario | Standard Actions | gh-aw |
|---|---|---|
| Run tests on every PR | Great fit | Overkill |
| Deploy on merge | Great fit | Overkill |
| Decompose a PRD into ordered tasks | Poor fit | Natural fit |
| Implement a feature from a natural-language issue | Poor fit | Natural fit |
| Review a PR against acceptance criteria | Poor fit | Natural fit |
| Diagnose a CI failure pattern | Limited | Natural fit |
| Enforce a merge boundary or ruleset | Great fit | Wrong authority layer |

## When gh-aw does not make sense

- deterministic, well-defined tasks
- high-frequency, low-latency jobs
- control-plane changes such as rulesets, secrets, or deploy policy
- any step where widening authority would be more dangerous than waiting for a
  human

## The bottom line

gh-aw is not a replacement for GitHub Actions. In this repo it is the part that
does the AI work, inside a system where humans own the rules. Actions keep the authority,
state transitions, and merge boundary deterministic. gh-aw handles the work that
requires reading, reasoning, and generating.

That split is why the system is useful.

## Upstream contributions

The most active external contributor to gh-aw in its first month. 31 findings
cataloged, 19 issues filed, 17 fixes shipped across 8 releases, 15 credited
by name in release notes.

| Release | Fixes |
|---|---|
| [`v0.51.3`](https://github.com/github/gh-aw/releases/tag/v0.51.3) | Concurrency group collapse, malformed reference validation |
| [`v0.51.6`](https://github.com/github/gh-aw/releases/tag/v0.51.6) | JSON state collapse, auto-merge gating |
| [`v0.53.0`](https://github.com/github/gh-aw/releases/tag/v0.53.0) | Push retry/backoff, stderr leak, ENOENT noise, model flag |
| [`v0.53.3`](https://github.com/github/gh-aw/releases/tag/v0.53.3) | PR error crash, duplicate issue creation, missing labels |
| [`v0.56.1`](https://github.com/github/gh-aw/releases/tag/v0.56.1) | Safe-outputs escalation, dispatch validation, bot identity matching |
| [`v0.63.0`](https://github.com/github/gh-aw/releases/tag/v0.63.0) | Release attribution missing fixes when resolution flows through follow-up issues |

## References

- [gh-aw repository](https://github.com/github/gh-aw)
- [Technical preview announcement](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/)
- [Automate repository tasks with GitHub Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/)
- [Official documentation](https://github.github.com/gh-aw/)
