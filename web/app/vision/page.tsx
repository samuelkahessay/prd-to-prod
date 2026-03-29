import { Metadata } from "next";
import { StickyNav } from "@/components/landing/sticky-nav";
import { HarnessLayers } from "@/components/vision/harness-layers";
import { LandscapeMap } from "@/components/vision/landscape-map";
import styles from "./page.module.css";

const AUDIENCE_FRAMES = [
  {
    audience: "For founders",
    title: "Replace prototype theater with governed shipping.",
    body:
      "The point is not to get another flashy build. The point is to get a repo, CI, deployment, and an approval boundary your team can trust.",
  },
  {
    audience: "For investors",
    title: "The strategic layer is moving above code generation.",
    body:
      "As agents make code abundant, value concentrates in orchestration, control, recovery, and the evidence trail behind every release.",
  },
] as const;

const SIGNALS = [
  { value: "3", label: "end-to-end self-healing drills completed" },
  { value: "12 min", label: "last autonomous CI recovery" },
  { value: "19", label: "GitHub platform issues surfaced" },
  { value: "17", label: "fixes shipped back upstream" },
] as const;

const HARNESS_LAYERS = [
  {
    label: "Autonomy Policy",
    description:
      "A machine-readable file that defines what agents can and cannot do. Unrecognized actions are blocked by default.",
    color: "#8b5cf6",
  },
  {
    label: "Decision State Machine",
    description:
      "Human intervention is constrained to a fixed set of choices — Approved or Rejected — instead of freeform operator behavior.",
    color: "#6e8cff",
  },
  {
    label: "Identity Separation",
    description:
      "The agent that writes code can never be the same identity that approves it. Builder and reviewer stay distinct.",
    color: "#14b8a6",
  },
  {
    label: "Self-Healing Loops",
    description:
      "CI failures are detected, diagnosed, and repaired by agents without a human taking over the keyboard.",
    color: "#f59e0b",
  },
  {
    label: "Deterministic Scaffolding",
    description:
      "GitHub Actions owns routing, policy enforcement, deploy, and merge authority. Agents operate inside the system, not above it.",
    color: "#ef4444",
  },
] as const;

const FOUNDER_POINTS = [
  {
    label: "Brief in, governed repo out",
    body:
      "The product brief becomes issues, pull requests, review, deployment, and a delivery record instead of a dead-end prototype.",
  },
  {
    label: "Humans stay on intent and approval",
    body:
      "Founders should define what matters and approve material decisions, not babysit every implementation step.",
  },
  {
    label: "Operational drag drops early",
    body:
      "A self-healing pipeline matters most when the team is small and every broken CI run steals attention from the roadmap.",
  },
] as const;

const INVESTOR_POINTS = [
  {
    label: "This is infrastructure, not a wrapper",
    body:
      "The durable layer is the control plane that governs autonomous software delivery, not just the interface that prompts a model.",
  },
  {
    label: "Governance becomes product surface area",
    body:
      "As agent volume scales, policy, identity separation, approval boundaries, and auditability become mandatory system primitives.",
  },
  {
    label: "Depth creates defensibility",
    body:
      "Running the full loop exposes real platform failures, integration edges, and buyer pain that shallow demos never uncover.",
  },
] as const;

const MARKET_SIGNALS = [
  {
    company: "GitHub",
    detail:
      "Agentic Workflows points version-control-native infrastructure toward agent execution.",
  },
  {
    company: "Vercel",
    detail:
      "The platform is positioning itself around the agentic application stack, not just static hosting.",
  },
  {
    company: "OpenAI",
    detail:
      "Symphony reinforces that orchestration, routing, and recovery are now part of the application layer.",
  },
  {
    company: "Factory",
    detail:
      "Capital is flowing toward end-to-end autonomous SDLC systems, not just coding copilots.",
  },
  {
    company: "Mendral",
    detail:
      "Point solutions are emerging around self-healing, which is one layer of a much larger governed pipeline.",
  },
] as const;

const POSITIONING_COMPANIES = [
  {
    name: "Lovable / Bolt",
    x: 12,
    y: 10,
    detail: "Code gen from prompts. No pipeline. Human is still the loop.",
  },
  {
    name: "Devin",
    x: 35,
    y: 25,
    detail: "Ticket to PR. Human boundary is implied more than formalized.",
  },
  {
    name: "Factory",
    x: 65,
    y: 45,
    detail: "End-to-end SDLC ambition with dashboard-style governance.",
  },
  {
    name: "Mendral",
    x: 40,
    y: 35,
    detail: "Focused on CI self-healing rather than the full delivery loop.",
  },
  {
    name: "Symphony",
    x: 45,
    y: 20,
    detail: "Issue routing and orchestration, but not yet a full governed boundary.",
  },
  {
    name: "prd-to-prod",
    x: 88,
    y: 85,
    detail: "Brief to deploy plus self-heal with an explicit policy artifact.",
    highlight: true,
  },
] as const;

export const metadata: Metadata = {
  title: "Vision - prd-to-prod",
  description:
    "The case for governed autonomous delivery infrastructure for founders and investors.",
};

export default function VisionPage() {
  return (
    <div className={styles.shell}>
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <article className={styles.article}>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>Vision</p>

            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <h1 className={styles.title}>
                  Code Generation Is Solved.
                  <br />
                  Delivery Isn&apos;t.
                </h1>

                <p className={styles.lede}>
                  The winning companies in the agent era will not be the ones
                  that can generate the most code. They will be the ones that
                  can turn generated code into governed, repeatable delivery.
                </p>

                <p className={styles.heroBody}>
                  Founders need a way to move from product brief to shipped
                  software without turning every release into manual operations.
                  Investors should see the control plane for autonomous software
                  delivery forming in real time.
                </p>
              </div>

              <aside className={styles.thesisCard}>
                <p className={styles.cardEyebrow}>The thesis in one line</p>
                <p className={styles.thesisBody}>
                  As code creation becomes abundant, the scarce layer moves
                  up-stack: orchestration, human control, recovery, and proof.
                </p>

                <div className={styles.actions}>
                  <a
                    href="https://calendly.com/kahessay"
                    className={styles.ctaPrimary}
                    target="_blank"
                    rel="noopener"
                  >
                    Book a call
                  </a>
                  <a
                    href="https://github.com/samuelkahessay/prd-to-prod"
                    className={styles.ctaSecondary}
                    target="_blank"
                    rel="noopener"
                  >
                    Review the repo
                  </a>
                </div>
              </aside>
            </div>

            <div className={styles.audienceGrid}>
              {AUDIENCE_FRAMES.map((frame) => (
                <section key={frame.audience} className={styles.audienceCard}>
                  <p className={styles.cardEyebrow}>{frame.audience}</p>
                  <h2 className={styles.audienceTitle}>{frame.title}</h2>
                  <p className={styles.audienceBody}>{frame.body}</p>
                </section>
              ))}
            </div>

            <div className={styles.signalGrid} role="list" aria-label="Proof signals">
              {SIGNALS.map((signal) => (
                <div key={signal.label} className={styles.signalCard} role="listitem">
                  <p className={styles.signalValue}>{signal.value}</p>
                  <p className={styles.signalLabel}>{signal.label}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>Thesis</p>
            <h2 className={styles.sectionTitle}>
              The bottleneck is the harness, not the model.
            </h2>

            <p className={styles.sectionLead}>
              Going from natural language to code is already a solved market.
              The harder problem is turning capable agents into a system
              reliable enough to trust with production work.
            </p>

            <p>
              Shipping is not just code generation. It is spec decomposition,
              independent review, deployment without manual handoffs, CI
              repair (the automated checks that verify code works), and an
              audit trail that still explains six months later why a decision
              was made and who approved it.
            </p>

            <p>
              Mitchell Hashimoto called this discipline harness engineering:
              the infrastructure around the agent, not the agent itself. In
              practical terms, that means the agents can be strong individually
              while the product still fails if the surrounding system cannot
              govern, recover, or prove what happened.
            </p>

            <HarnessLayers layers={HARNESS_LAYERS} />

            <p className={styles.sectionNote}>
              The agents operate inside this harness. They do not get to
              redefine it.
            </p>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>Implications</p>
            <h2 className={styles.sectionTitle}>
              What founders and investors should notice.
            </h2>

            <div className={styles.columns}>
              <section className={styles.columnCard}>
                <p className={styles.cardEyebrow}>Founders</p>
                <h3 className={styles.columnTitle}>
                  This is about shipping with less coordination overhead.
                </h3>
                <ul className={styles.bulletList}>
                  {FOUNDER_POINTS.map((point) => (
                    <li key={point.label} className={styles.bulletItem}>
                      <strong>{point.label}</strong>
                      <span>{point.body}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.columnCard}>
                <p className={styles.cardEyebrow}>Investors</p>
                <h3 className={styles.columnTitle}>
                  This is where the next software infrastructure layer gets
                  built.
                </h3>
                <ul className={styles.bulletList}>
                  {INVESTOR_POINTS.map((point) => (
                    <li key={point.label} className={styles.bulletItem}>
                      <strong>{point.label}</strong>
                      <span>{point.body}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>Evidence</p>
            <h2 className={styles.sectionTitle}>
              The proof already goes deeper than a demo.
            </h2>

            <p className={styles.sectionLead}>
              This repo is not interesting because it can generate code. It is
              interesting because it can keep a governed delivery loop running
              through real friction.
            </p>

            <div className={styles.featureCard}>
              <p className={styles.cardEyebrow}>First client build</p>
              <h3 className={styles.featureTitle}>
                Aurrin Ventures went from brief to working product in 6 days.
              </h3>
              <p className={styles.featureBody}>
                The pipeline produced a 12-module crowdfunding platform with 80
                merged pull requests across 133 issues. That matters to founders
                because the output is a working product, and it matters to
                investors because the system was tested under real delivery
                depth instead of a toy scenario.
              </p>
              <a
                href="/case-studies/aurrin-ventures"
                className={styles.inlineLink}
              >
                Read the case study
              </a>
            </div>

            <div className={styles.proofGrid}>
              <section className={styles.proofCard}>
                <h3 className={styles.proofTitle}>
                  Self-healing has already been proven end to end.
                </h3>
                <p className={styles.proofBody}>
                  The last drill resolved a CI failure in 12 minutes with zero
                  human intervention: detection, issue creation, agent dispatch,
                  diagnosis, fix PR, independent review, and auto-merge.
                </p>
              </section>

              <section className={styles.proofCard}>
                <h3 className={styles.proofTitle}>
                  Depth surfaced real upstream weaknesses.
                </h3>
                <p className={styles.proofBody}>
                  Building deep enough to chain agents, depend on structured
                  outputs, and run full lifecycle workflows surfaced 19 platform
                  issues in GitHub Agentic Workflows. 17 shipped as fixes across
                  7 releases.
                </p>
              </section>
            </div>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>Market</p>
            <h2 className={styles.sectionTitle}>
              The industry is converging on the same missing layer.
            </h2>

            <p className={styles.sectionLead}>
              Everyone can see the code-generation opportunity. The more
              important question now is who owns the governed delivery
              infrastructure around it.
            </p>

            <ul className={styles.list}>
              {MARKET_SIGNALS.map((signal) => (
                <li key={signal.company}>
                  <strong>{signal.company}</strong> {signal.detail}
                </li>
              ))}
            </ul>

            <LandscapeMap
              xLabel="Pipeline depth"
              yLabel="Human control boundary"
              companies={POSITIONING_COMPANIES}
            />

            <p>
              The gap is where agent autonomy rises and human authority becomes
              more explicit, not less. Once agents are doing the work, the
              system that decides what can ship becomes the product.
            </p>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>Closing</p>
            <h2 className={styles.sectionTitle}>
              What this repo is trying to earn.
            </h2>

            <p>
              <code>prd-to-prod</code> is not yet the finished commercial
              product. It is the working argument that governed autonomous
              delivery deserves to exist as a category.
            </p>

            <p>
              Founders can read it as a faster path from intent to launch
              without surrendering control. Investors can read it as an early
              control layer for the next software production stack.
            </p>

            <p className={styles.closing}>
              The bet is simple: code generation becomes table stakes. Governed
              delivery becomes the moat.
            </p>

            <div className={styles.footerGrid}>
              <a
                href="https://calendly.com/kahessay"
                className={styles.footerCard}
                target="_blank"
                rel="noopener"
              >
                <span className={styles.cardEyebrow}>Founders</span>
                <strong>Bring a live PRD and pressure-test the pipeline.</strong>
                <span>Book a working session.</span>
              </a>

              <a
                href="https://github.com/samuelkahessay/prd-to-prod"
                className={styles.footerCard}
                target="_blank"
                rel="noopener"
              >
                <span className={styles.cardEyebrow}>Investors</span>
                <strong>Start with the repo, then the thesis.</strong>
                <span>Review the implementation depth and market position.</span>
              </a>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
