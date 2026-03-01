# Why gh-aw: Agentic Workflows vs. Standard GitHub Actions

gh-aw (GitHub Agentic Workflows) entered [technical preview on February 13, 2026](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/). This document captures the rationale for using it alongside standard GitHub Actions in this pipeline, while the design decisions are still fresh.

## What gh-aw actually is

gh-aw is an open-source CLI extension (`gh extension install github/gh-aw`) built primarily in Go. It was created as a collaboration between GitHub Next, Microsoft Research, and Azure Core Upstream, and is [MIT-licensed](https://github.com/github/gh-aw).

The core idea: you write a **Markdown file** (`.github/workflows/<name>.md`) with YAML frontmatter for triggers and permissions, and a natural language body describing what the agent should do. Then `gh aw compile` generates a hardened GitHub Actions YAML file (`.lock.yml`) that runs an AI coding agent in a containerized environment.

```
.github/workflows/repo-assist.md      ← you write this (natural language)
        │
        │  gh aw compile
        ▼
.github/workflows/repo-assist.lock.yml ← gh-aw generates this (Actions YAML)
```

### Supported agents

gh-aw is not tied to a single model. It supports three engines:

| Engine | Secret required |
|---|---|
| GitHub Copilot (default) | `COPILOT_GITHUB_TOKEN` |
| Claude (Anthropic) | `ANTHROPIC_API_KEY` |
| Codex (OpenAI) | `OPENAI_API_KEY` |

This repo uses Copilot (gpt-5) for all four agentic workflows.

### Security model

gh-aw takes a defense-in-depth approach — this is one of its strongest design choices compared to running agents directly in Actions YAML with broad permissions:

- **Read-only by default** — workflows cannot write unless explicitly granted
- **Safe outputs** — write operations (comments, issues, PRs) go through sanitized, validated channels rather than raw API calls
- **Sandboxed execution** — tool allowlisting restricts what the agent can invoke
- **Network isolation** — agents cannot make arbitrary network calls
- **SHA-pinned dependencies** — supply chain security baked into the compiled output
- **Compile-time validation** — `gh aw compile` catches configuration errors before runtime
- **Human approval gates** — critical operations can require human sign-off

### Cost

When using Copilot as the engine, each workflow run typically costs ~2 premium requests — one for the agent work, one for guardrail validation.

## The core distinction

GitHub Actions is a **deterministic CI/CD system**. You define YAML workflows that run predefined steps — build, test, deploy. Every run follows the same path. This works well when you know exactly what needs to happen.

gh-aw is an **agentic execution engine**. Instead of fixed steps, an LLM agent receives a prompt, reads context (issues, diffs, the codebase), reasons about what to do, and takes action. The path through the workflow is decided at runtime by the agent.

```
GitHub Actions:    trigger → step 1 → step 2 → step 3 → done
gh-aw:             trigger → agent reads context → agent reasons → agent acts → verifies → done
```

The moment a workflow requires **judgment** — interpreting a natural language spec, deciding which files to change, choosing an implementation approach — Actions becomes awkward. You end up encoding decision-making into a system designed for deterministic execution. gh-aw is built for exactly that gap.

GitHub frames this as **"Continuous AI"** — a complement to traditional CI/CD, not a replacement. The [six use case categories](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/) they identify are: continuous triage, continuous documentation, continuous code simplification, continuous test improvement, continuous quality hygiene, and continuous reporting.

## How this pipeline splits the work

This repo uses both. The split follows a simple rule: **deterministic logic stays in Actions, judgment goes to gh-aw.**

### Standard GitHub Actions (deterministic)

| Workflow | Purpose |
|---|---|
| `dotnet-ci.yml` | Build and test on every PR |
| `deploy-azure.yml` | Build, publish, deploy to Azure on merge |
| `copilot-setup-steps.yml` | Environment setup (install .NET SDK, gh-aw) |
| `close-issues.yml` | Parse PR body for `Closes #N`, close linked issues |
| `auto-dispatch.yml` | Debounce guard — check if repo-assist is already running, then dispatch |
| `pr-review-submit.yml` | Parse `[PIPELINE-VERDICT]` comment, submit formal GH review, enable auto-merge, dispatch next cycle |
| `ci-failure-issue.yml` | Extract failure logs, post `/repo-assist` repair command to linked issue |
| `ci-failure-resolve.yml` | Update incident comment to "resolved" when CI passes after a failure |
| `pipeline-watchdog.yml` | Cron stall detector — retry stuck repairs, escalate orphaned issues |

These workflows are routing, guard logic, state transitions, and deployment. They follow fixed rules: if X then Y. No ambiguity, no judgment needed.

### gh-aw agentic workflows (LLM-powered)

| Workflow | Source | Purpose |
|---|---|---|
| `repo-assist.lock.yml` | `repo-assist.md` | Read pipeline issues, explore codebase, write code, open draft PRs, fix CI failures |
| `pr-review-agent.lock.yml` | `pr-review-agent.md` | Read full PR diff + linked issue acceptance criteria, produce structured APPROVE/REQUEST_CHANGES verdict |
| `prd-decomposer.lock.yml` | `prd-decomposer.md` | Break a PRD into atomic implementation issues with acceptance criteria and dependency ordering |
| `pipeline-status.lock.yml` | `pipeline-status.md` | Generate daily rolling status report across all pipeline work |

These workflows require reading, reasoning, and generating. An issue says "add rate limiting to the API" — the agent has to figure out which files exist, what patterns the codebase uses, and how to implement it. No amount of YAML conditionals can do that.

### The naming convention

The `.md` → `.lock.yml` pair is fundamental to gh-aw. You author in Markdown, `gh aw compile` produces the lock file. The `.lock.yml` is what GitHub Actions actually runs. Standard workflows use plain `.yml` with no Markdown source. The distinction is visible at a glance in the file listing.

## Why gh-aw makes sense here

### 1. It closes the "last mile" gap

The industry has automated building, testing, and deploying for years. But writing code remained manual. gh-aw puts an agent in that gap — a design brief (GitHub issue) goes in, a working PR comes out. This pipeline chains that capability into a loop: decompose → implement → review → merge → repeat.

### 2. Natural language becomes the interface

In this repo, humans write issues as product specs (problem, solution, acceptance criteria). The pipeline handles implementation. The "programming language" is English with verifiable acceptance criteria. This is a genuine shift in abstraction level — the human role moves from writing code to writing design briefs.

### 3. Agents compose into a pipeline

This isn't a single agent chat session. Multiple agents with different roles form a pipeline with checkpoints:

- `prd-decomposer` breaks down the spec
- `repo-assist` implements each piece
- `pr-review-agent` reviews against acceptance criteria
- `pr-review-submit` (Actions) enforces the merge gate

Each stage has a defined contract. The review agent doesn't trust the implementation agent — it independently verifies against the original spec. This is more robust than a single agent doing everything.

### 4. The deterministic scaffolding matters

The agentic workflows don't operate in a vacuum. They're surrounded by deterministic Actions that provide:

- **Guard rails** — `auto-dispatch` prevents flooding, `pr-review-submit` defaults to REQUEST_CHANGES on unparseable verdicts
- **Self-healing** — `ci-failure-issue` turns build failures into repair tasks, `pipeline-watchdog` catches stalls every 30 minutes
- **Identity separation** — the Copilot agent can't approve its own PRs; `github-actions[bot]` submits the formal review

This is the key architectural insight: **Actions form the nervous system, gh-aw agents are the brain.** Neither replaces the other.

## When gh-aw makes more sense than standard Actions

| Scenario | Standard Actions | gh-aw |
|---|---|---|
| Run tests on every PR | Great fit | Overkill |
| Deploy to staging on merge | Great fit | Overkill |
| Implement a feature from a natural language spec | Cannot do this | Built for this |
| Fix a bug described in an issue | Cannot do this | Built for this |
| Review a PR against acceptance criteria | Cannot do this | Natural fit |
| Decompose a PRD into ordered tasks | Cannot do this | Natural fit |
| Adaptive error recovery (read logs, reason, fix) | Rigid retry logic | Agent reasons about the failure |
| Triage and label incoming issues | Fragile heuristics | Natural fit |
| Generate status reports from live repo state | Template-based at best | Natural fit |
| Route events and enforce state machines | Great fit | Overkill |

## When gh-aw does not make sense

- **Deterministic, well-defined tasks** — if you know the exact steps, Actions is simpler, cheaper, and more predictable
- **High-frequency, low-latency jobs** — agent reasoning adds latency and cost (~2 premium requests per run)
- **Security-critical deployment gates** — an agent making autonomous decisions about production deploys is a risk most teams would not accept today
- **Strict auditability requirements** — deterministic workflows produce predictable audit trails; agentic ones are harder to trace

## The bottom line

gh-aw does not replace GitHub Actions. It fills a role that Actions was never designed for: turning intent into implementation. The two work best together — Actions handling the predictable machinery of CI/CD, gh-aw handling the tasks that require understanding and judgment.

## References

- [gh-aw repository](https://github.com/github/gh-aw) (MIT license)
- [Technical preview announcement](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/) (Feb 13, 2026)
- [Blog: Automate repository tasks with GitHub Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/)
- [Official documentation](https://github.github.com/gh-aw/)
- [Sample workflow pack](https://github.com/githubnext/agentics) (50+ examples)
