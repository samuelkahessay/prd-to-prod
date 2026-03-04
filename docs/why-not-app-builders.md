# Why This Is Not an App Builder

Comparing `prd-to-prod` to Lovable or Base44 is comparing it to the wrong
category.

Those products are increasingly capable. They now cover far more than prompt to
UI: backend generation, auth, deploy, integrations, testing, and workspace
features. But they still optimize for **building an app from prompts**.
`prd-to-prod` optimizes for **operating a software delivery system**.

That distinction matters. The hard part is no longer proving that AI can write
code. The hard part is deciding who can do what, under which identity, through
which gate, with what evidence when something goes wrong.

## What App Builders Optimize For

App builders compress the path from idea to working application.

That is useful. It is also a different problem.

They are designed to answer questions like:

- Can I turn a prompt into a usable full-stack app quickly?
- Can I add auth, storage, integrations, and deploy without hand wiring
  infrastructure?
- Can a non-expert ship internal tools or prototypes with much less setup?

`prd-to-prod` is not trying to win that benchmark.

## The Real Problem At Scale

When a team is landing large volumes of AI-generated changes, the bottleneck
stops being code generation and becomes operational control:

- **Routing** — which agent handles which work, and who decides?
- **Review** — is the evaluator independent from the author?
- **Authority** — which paths are autonomous, and which are human-gated?
- **Recovery** — who detects CI or deploy failures, who fixes them, and who
  verifies the repair?
- **Audit** — can an operator reconstruct what happened from durable artifacts,
  not chat memory?
- **Stopping conditions** — where does the system structurally stop rather than
  merely receiving a softer prompt?

App builders help a person build an app. `prd-to-prod` is aimed at the control
plane above that.

## The Closer Comparison Set

If you want to compare `prd-to-prod` to products that are actually nearby, the
closer set today is:

- [Factory](https://factory.ai/) — the closest commercial product in ambition.
  Factory explicitly positions itself as agent-native software development from
  IDE to CI/CD, with backlog-triggered work, PR creation, incident response,
  code review, and self-healing builds.
- [Devin](https://docs.devin.ai/) — the closest single-agent teammate product.
  Devin integrates with GitHub, Linear, Jira, and APIs; it creates PRs,
  responds to PR comments, and now includes automatic PR review.
- [GitHub Copilot's agent stack](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent)
  — the closest platform primitive set. GitHub now offers coding agent,
  custom agents, code review, issue creation, rulesets, and Actions-powered
  execution environments. This is the substrate many teams will build on.
- [Cursor](https://docs.cursor.com/en/background-agent) — the closest async
  coding tool. Background agents and Bugbot can run remotely, open PRs, and
  iterate on code with checks and statuses, but the product center of gravity is
  still task execution rather than repo-owned delivery governance.

This matters because the honest answer to "what does this compete with?" is
**not** "Lovable." It is "parts of Factory, Devin, GitHub, and Cursor."

## What None Of Those Gives You By Default

Based on the current product docs, no single product appears to package the
exact combination `prd-to-prod` is demonstrating:

- A **repo-owned control plane** where orchestration, gates, and escalation live
  in checked-in workflows instead of a vendor dashboard.
- A **machine-readable autonomy policy** in
  [`autonomy-policy.yml`](../autonomy-policy.yml) that fails closed and can gate
  file-level authority.
- **Identity-separated delivery** where builder and reviewer are distinct actors
  inside the same GitHub-native loop.
- A **durable operator trail** across issues, PRs, decision artifacts, and drill
  reports.
- A **single visible loop** from PRD to decomposition to implementation to
  review to bounded merge to first-line repair.

That is the positioning: `prd-to-prod` is not a better prompt-to-app machine.
It is a clearer example of a policy-bounded delivery system.

## Where prd-to-prod Is Stronger

| Concern | Nearby products | prd-to-prod |
|---|---|---|
| Control plane | Usually product-owned | Repo-owned, checked in, inspectable |
| Policy boundary | Often admin settings or product permissions | Explicit file-level policy in [`autonomy-policy.yml`](../autonomy-policy.yml) |
| Review independence | Often optional or product-specific | Built into the loop as a separate review actor |
| Recovery loop | Varies by product | Part of the demonstrated system design |
| Auditability | Usually split across vendor UIs | Git-native trail plus operator-facing artifacts |
| Evidence | Product claims | Public repo history, workflow runs, drills, decision artifacts |

## Where prd-to-prod Is Weaker

This repo is not magic, and it is not a finished commercial product.

- It is opinionated and GitHub-centric.
- It is rougher than products like Factory, Devin, or Cursor.
- It does not yet offer the polished admin UX, analytics, and enterprise surface
  area those platforms are building.
- Throughput is still constrained by the repo's current workflow design.

So the honest claim is not "nothing else exists."

The honest claim is: **the closest products are now serious and real, but this
repo is making a different point.** It shows what it looks like when the
delivery control plane itself is explicit, bounded, and inspectable.

## The One-Line Distinction

App builders prove AI can generate software.

`prd-to-prod` argues that the more interesting problem is whether AI can operate
a delivery loop with policy boundaries, identity separation, bounded autonomy,
and durable evidence.

That is a harder claim, and it is the one this repo is trying to earn.
