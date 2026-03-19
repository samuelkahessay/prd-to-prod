import { Metadata } from "next";
import { StickyNav } from "@/components/landing/sticky-nav";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Vision — prd-to-prod",
  description:
    "Code generation is solved. Delivery isn't. The thesis behind prd-to-prod.",
};

export default function VisionPage() {
  return (
    <div className={styles.shell}>
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <article className={styles.article}>
          <h1 className={styles.title}>
            Code Generation Is Solved.
            <br />
            Delivery Isn&rsquo;t.
          </h1>

          <p className={styles.lede}>
            Going from natural language to code is a solved problem. Lovable,
            Bolt, Replit, Base44, Emergent &mdash; the market has proven the
            demand. If you can describe what you want, an AI can build it.
          </p>

          <p>
            But &ldquo;build it&rdquo; is not &ldquo;ship it.&rdquo;
          </p>

          <p>
            Shipping means decomposing a spec into tasks that can be
            parallelized. It means code review where the evaluator is
            independent from the author. It means deployment that does not
            require a human clicking a button. It means CI that self-heals
            instead of paging someone. It means an audit trail that answers, six
            months later, <em>why was this decision made and who authorized it?</em>
          </p>

          <p>
            This is the problem <code>prd-to-prod</code> exists to solve.
          </p>

          <hr className={styles.divider} />

          <h2>The bottleneck is the harness, not the model</h2>

          <p>
            The agents this pipeline uses &mdash; Copilot, Claude, Codex &mdash;
            are individually capable. They can implement features, write tests,
            review code, diagnose CI failures. The hard problem is orchestrating
            them into a system reliable enough to trust with production
            workloads.
          </p>

          <p>
            Mitchell Hashimoto (co-founder of HashiCorp, creator of Terraform)
            named this discipline{" "}
            <em>harness engineering</em> in February 2026: designing systems that
            wrap around AI agents to make them reliable and governable. The
            infrastructure around the agent, not the agent itself.
          </p>

          <p>
            LangChain demonstrated the principle: same model, 52.8% to 66.5%
            task success rate. The only variable was the harness. OpenAI built a
            million lines of code with Codex agents by designing better
            orchestration, constraints, and recovery loops.
          </p>

          <p>
            In <code>prd-to-prod</code>, the harness is:
          </p>

          <ul className={styles.list}>
            <li>
              An <strong>autonomy policy</strong> that defines what agents can
              and cannot do
            </li>
            <li>
              A <strong>decision state machine</strong> that constrains human
              interventions to a small, reasoned-about set
            </li>
            <li>
              <strong>Identity separation</strong> so the agent that writes code
              can never approve its own work
            </li>
            <li>
              <strong>Self-healing loops</strong> that detect CI failures,
              diagnose root causes, and open fix PRs without human intervention
            </li>
            <li>
              <strong>Deterministic scaffolding</strong> in standard GitHub
              Actions that owns routing, policy, deploy, and merge authority
            </li>
          </ul>

          <p>The agents operate inside this harness. They do not get to redefine it.</p>

          <hr className={styles.divider} />

          <h2>What this looks like in practice</h2>

          <p>
            The pipeline takes a product brief in natural language. Agents
            decompose it into issues, implement each as a PR, review each
            other&rsquo;s work, merge, deploy, and self-heal when CI breaks. No
            human writes implementation code. Humans write intent, set policy,
            and approve decisions at defined escalation points.
          </p>

          <p>
            The self-healing loop has been proven end-to-end three times. The
            last drill resolved a CI failure in 12 minutes with zero human
            intervention: failure detection &rarr; issue creation &rarr; agent
            dispatch &rarr; root cause diagnosis &rarr; fix PR &rarr;
            independent review &rarr; auto-merge.
          </p>

          <p>
            Building this pipeline deep enough to chain agents, depend on
            structured outputs, and run full lifecycle workflows surfaced 19
            genuine platform issues in GitHub&rsquo;s Agentic Workflows. 17
            shipped as fixes across 7 releases. Depth stresses edges that
            shallow integrations never touch.
          </p>

          <hr className={styles.divider} />

          <h2>Where the industry is converging</h2>

          <p>
            The infrastructure layer for autonomous agents is being built right
            now:
          </p>

          <ul className={styles.list}>
            <li>
              <strong>GitHub</strong> shipped{" "}
              <a
                href="https://github.com/github/gh-aw"
                target="_blank"
                rel="noopener"
              >
                Agentic Workflows
              </a>{" "}
              in technical preview &mdash; the first agent-native platform from
              the company that owns version control
            </li>
            <li>
              <strong>Vercel</strong> is positioning as the agentic
              infrastructure for apps and agents, with Hashimoto joining their
              board
            </li>
            <li>
              <strong>OpenAI</strong> open-sourced Symphony &mdash; an agent
              orchestration framework that routes Linear tickets to Codex agents
            </li>
            <li>
              <strong>Factory</strong> raised $70M from Sequoia and NVIDIA for
              autonomous &ldquo;Droids&rdquo; that handle the full SDLC
            </li>
            <li>
              <strong>Mendral</strong> (YC W26, founded by Docker&rsquo;s first
              two engineers) is automating CI self-healing
            </li>
          </ul>

          <p>
            Everyone is building pieces. The code generation piece is solved.
            What is unsolved is the delivery infrastructure: the harness that
            turns capable individual agents into a reliable autonomous pipeline
            with an explicit human control boundary.
          </p>

          <hr className={styles.divider} />

          <h2>The positioning gap</h2>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>Generates code</th>
                  <th>Full pipeline</th>
                  <th>Human boundary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Lovable / Bolt</td>
                  <td>Yes</td>
                  <td>No</td>
                  <td>Human is the loop</td>
                </tr>
                <tr>
                  <td>Devin</td>
                  <td>Yes</td>
                  <td>Ticket &rarr; PR</td>
                  <td>Implicit</td>
                </tr>
                <tr>
                  <td>Factory</td>
                  <td>Yes (Droids)</td>
                  <td>Full SDLC</td>
                  <td>Dashboard</td>
                </tr>
                <tr>
                  <td>Mendral</td>
                  <td>Fixes only</td>
                  <td>CI self-heal</td>
                  <td>Automated</td>
                </tr>
                <tr>
                  <td>OpenAI Symphony</td>
                  <td>Via Codex</td>
                  <td>Issue &rarr; PR</td>
                  <td>Not yet formalized</td>
                </tr>
                <tr className={styles.highlightRow}>
                  <td><strong>prd-to-prod</strong></td>
                  <td><strong>Via agents</strong></td>
                  <td><strong>Brief &rarr; deploy + self-heal</strong></td>
                  <td><strong>Explicit policy artifact</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            The last column is where the gap is. When agents do the work,
            human authority becomes the most important part of the system. The
            question becomes: who decides what ships, and can you prove it.
          </p>

          <p>
            No single product currently packages the exact combination this repo
            demonstrates: full pipeline from brief to deploy, multi-agent
            orchestration, self-healing, and a formalized human control boundary
            as a repo-owned artifact.
          </p>

          <hr className={styles.divider} />

          <h2>What this repo is trying to earn</h2>

          <p>
            <code>prd-to-prod</code> is not a finished commercial product. It is
            rougher than Factory, Devin, or Cursor. It does not have the
            enterprise surface area those platforms are building.
          </p>

          <p>
            What it does have is a working example of the thesis: that the next
            platform is for agents governed by humans shipping autonomously, and
            the harness &mdash; the orchestration, policy, identity separation,
            and recovery infrastructure &mdash; is what makes the difference
            between a demo and a delivery system.
          </p>

          <p className={styles.cta}>
            Building in this space?{" "}
            <a href="mailto:kahessay@icloud.com">Let&rsquo;s talk.</a>
          </p>
        </article>
      </main>
    </div>
  );
}
