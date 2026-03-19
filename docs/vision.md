# Vision: Code Generation Is Solved. Delivery Isn't.

Going from natural language to code is a solved problem. Lovable, Bolt, Replit,
Base44, Emergent — the market has proven the demand. If you can describe what you
want, an AI can build it.

But "build it" is not "ship it."

Shipping means decomposing a spec into tasks that can be parallelized. It means
code review where the evaluator is independent from the author. It means
deployment that does not require a human clicking a button. It means CI that
self-heals instead of paging someone. It means an audit trail that answers, six
months later, *why was this decision made and who authorized it?*

This is the problem `prd-to-prod` exists to solve.

## The bottleneck is the harness, not the model

The agents this repo uses — Copilot, Claude, Codex — are individually capable.
They can implement features, write tests, review code, diagnose CI failures. The
hard problem is orchestrating them into a system reliable enough to trust with
production workloads.

Mitchell Hashimoto (co-founder of HashiCorp, creator of Terraform) named this
discipline *harness engineering* in February 2026: designing systems that wrap
around AI agents to make them reliable and governable. The infrastructure around
the agent, not the agent itself.

LangChain demonstrated the principle: same model, 52.8% to 66.5% task success
rate. The only variable was the harness. OpenAI built a million lines of code
with Codex agents by designing better orchestration, constraints, and recovery
loops.

In `prd-to-prod`, the harness is:

- An **autonomy policy** that defines what agents can and cannot do
- A **decision state machine** that constrains human interventions to a small,
  reasoned-about set
- **Identity separation** so the agent that writes code can never approve its own
  work
- **Self-healing loops** that detect CI failures, diagnose root causes, and open
  fix PRs without human intervention
- **Deterministic scaffolding** in standard GitHub Actions that owns routing,
  policy, deploy, and merge authority

The agents operate inside this harness. They do not get to redefine it.

## What this looks like in practice

The pipeline takes a product brief in natural language. Agents decompose it into
issues, implement each as a PR, review each other's work, merge, deploy, and
self-heal when CI breaks. No human writes implementation code. Humans write
intent, set policy, and approve decisions at defined escalation points.

The self-healing loop has been proven end-to-end three times. The last drill
resolved a CI failure in 12 minutes with zero human intervention: failure
detection → issue creation → agent dispatch → root cause diagnosis → fix PR →
independent review → auto-merge.

Building this pipeline deep enough to chain agents, depend on structured outputs,
and run full lifecycle workflows surfaced 19 genuine platform issues in GitHub's
Agentic Workflows. 17 shipped as fixes across 7 releases. Depth stresses edges
that shallow integrations never touch.

## Where the industry is converging

The infrastructure layer for autonomous agents is being built right now:

- **GitHub** shipped [Agentic Workflows](https://github.com/github/gh-aw) in
  technical preview — the first agent-native platform from the company that owns
  version control
- **Vercel** is positioning as the agentic infrastructure for apps and agents,
  with Hashimoto joining their board
- **OpenAI** open-sourced
  [Symphony](https://github.com/openai/openai-symphony) — an agent orchestration
  framework that routes Linear tickets to Codex agents
- **Factory** raised $70M from Sequoia and NVIDIA for autonomous "Droids" that
  handle the full SDLC
- **Mendral** (YC W26, founded by Docker's first two engineers) is automating CI
  self-healing

Everyone is building pieces. The code generation piece is solved. What is
unsolved is the delivery infrastructure: the harness that turns capable
individual agents into a reliable autonomous pipeline with an explicit human
control boundary.

## The positioning gap

| | Generates code | Full pipeline | Human boundary |
|---|---|---|---|
| Lovable / Bolt | Yes | No | Human is the loop |
| Devin | Yes | Ticket → PR | Implicit |
| Factory | Yes (Droids) | Full SDLC | Dashboard |
| Mendral | Fixes only | CI self-heal | Automated |
| OpenAI Symphony | Via Codex | Issue → PR | Not yet formalized |
| **prd-to-prod** | **Via agents** | **Brief → deploy + self-heal** | **Explicit policy artifact** |

The last column is where the gap is. When agents do the work, human authority
becomes the most important part of the system. The question becomes: who decides
what ships, and can you prove it.

No single product currently packages the exact combination this repo
demonstrates: full pipeline from brief to deploy, multi-agent orchestration,
self-healing, and a formalized human control boundary as a repo-owned artifact.

That is not a claim that nothing else exists. It is a claim that this specific
combination is underserved and worth demonstrating.

## What this repo is trying to earn

`prd-to-prod` is not a finished commercial product. It is rougher than Factory,
Devin, or Cursor. It does not have the enterprise surface area those platforms
are building.

What it does have is a working example of the thesis: that the next platform is
for agents governed by humans shipping autonomously, and the harness — the
orchestration, policy, identity separation, and recovery infrastructure — is what
makes the difference between a demo and a delivery system.
