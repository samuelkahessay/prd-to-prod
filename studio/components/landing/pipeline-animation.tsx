"use client";

import { useRef, useEffect } from "react";
import styles from "./pipeline-animation.module.css";

const ACT_NAMES = ["Brief", "Plan", "Build", "Ship", "Heal"];

// Colors
const C = {
  ink3: "#8e877f",
  ink4: "#b5afa8",
  rule: "#ddd8d1",
  accent: "#4a6fd8",
  accentFade: "rgba(74,111,216,0.12)",
  good: "#3d9a6a",
  goodFade: "rgba(61,154,106,0.15)",
  heal: "#c45a3c",
  healFade: "rgba(196,90,60,0.15)",
  policy: "#9b7ed8",
  policyFade: "rgba(155,126,216,0.15)",
  chaos: "#c4bdb5",
  chaosFade: "rgba(196,189,181,0.25)",
};

// 9s loop
const LOOP = 9;
const ACTS = [
  { start: 0, end: 1.5 },
  { start: 1.5, end: 3.0 },
  { start: 3.0, end: 5.5 },
  { start: 5.5, end: 7.0 },
  { start: 7.0, end: 9.0 },
];

// Layout positions (normalized 0-1)
const L = {
  mainY: 0.42,
  prdX: 0.10,
  decompX: 0.20,
  issueStartX: 0.28,
  issueLanes: [0.22, 0.42, 0.62],
  buildX: 0.44,
  prX: 0.56,
  reviewX: 0.70,
  reviewY: 0.42,
  deployX: 0.88,
  deployY: 0.42,
  policyX: 0.78,
  policyY: 0.13,
  monitorY: 0.70,
  healReturnX: 0.44,
};

interface EntityOpts {
  tx?: number;
  ty?: number;
  r?: number;
  color?: string;
  wash?: string;
  shape?: "circle" | "rect" | "diamond" | "terminal";
  label?: string;
  fadeIn?: number;
  easing?: number;
  type?: string;
  delay?: number;
  maxTrail?: number;
}

class Entity {
  x: number;
  y: number;
  tx: number;
  ty: number;
  r: number;
  color: string;
  wash: string;
  shape: string;
  label: string;
  alpha = 0;
  fadeIn: number;
  easing: number;
  type: string;
  delay: number;
  age = 0;
  trail: { x: number; y: number }[] = [];
  maxTrail: number;
  settled = false;
  pulsePhase = Math.random() * Math.PI * 2;
  dead = false;
  fadeOut = false;
  fadeOutStart = 0;

  constructor(x: number, y: number, opts: EntityOpts = {}) {
    this.x = x;
    this.y = y;
    this.tx = opts.tx ?? x;
    this.ty = opts.ty ?? y;
    this.r = opts.r ?? 6;
    this.color = opts.color ?? C.accent;
    this.wash = opts.wash ?? C.accentFade;
    this.shape = opts.shape ?? "circle";
    this.label = opts.label ?? "";
    this.fadeIn = opts.fadeIn ?? 0.3;
    this.easing = opts.easing ?? 0.045;
    this.type = opts.type ?? "";
    this.delay = opts.delay ?? 0;
    this.maxTrail = opts.maxTrail ?? 18;
  }

  update(dt: number, time: number) {
    void time;
    this.age += dt;
    if (this.age < this.delay) return;
    const active = this.age - this.delay;
    this.alpha = active < this.fadeIn ? active / this.fadeIn : 1;
    if (this.fadeOut) {
      this.alpha = Math.max(0, 1 - (this.age - this.fadeOutStart) / 0.4);
      if (this.alpha <= 0) this.dead = true;
    }
    if (this.maxTrail > 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) this.trail.shift();
    }
    this.x += (this.tx - this.x) * this.easing;
    this.y += (this.ty - this.y) * this.easing;
    if (Math.abs(this.tx - this.x) < 0.8 && Math.abs(this.ty - this.y) < 0.8)
      this.settled = true;
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    if (this.age < this.delay || this.alpha <= 0) return;
    const a = this.alpha;
    const pulse = Math.sin(time * 3.5 + this.pulsePhase) * 0.3 + 0.7;

    // Trail
    if (this.trail.length > 1 && this.shape === "circle") {
      for (let i = 0; i < this.trail.length; i++) {
        ctx.globalAlpha = (i / this.trail.length) * 0.18 * a;
        ctx.beginPath();
        ctx.arc(this.trail[i].x, this.trail[i].y, this.r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = a;

    if (this.shape === "circle") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 5 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = this.wash;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    } else if (this.shape === "rect") {
      const rw = this.r * 4;
      const rh = this.r * 2.2;
      ctx.beginPath();
      ctx.roundRect(this.x - rw / 2, this.y - rh / 2, rw, rh, 4);
      ctx.fillStyle = this.wash;
      ctx.fill();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (this.shape === "diamond") {
      const s = this.r + pulse * 2.5;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = this.wash;
      ctx.fillRect(-s - 3, -s - 3, (s + 3) * 2, (s + 3) * 2);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    } else if (this.shape === "terminal") {
      const outerR = this.r + 7 + pulse * 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, outerR, 0, Math.PI * 2);
      ctx.fillStyle = this.wash;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    if (this.label) {
      ctx.font = "500 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = C.ink3;
      ctx.fillText(
        this.label,
        this.x,
        this.shape === "terminal" ? this.y - this.r - 16 : this.y - this.r - 13,
      );
    }
    ctx.globalAlpha = 1;
  }

  kill() {
    this.fadeOut = true;
    this.fadeOutStart = this.age;
  }
  moveTo(tx: number, ty: number, easing?: number) {
    this.tx = tx;
    this.ty = ty;
    if (easing) this.easing = easing;
    this.settled = false;
  }
}

interface Connection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  alpha: number;
  width: number;
  dash?: number[];
  targetAlpha?: number;
}

function drawConnections(ctx: CanvasRenderingContext2D, connections: Connection[]) {
  for (const conn of connections) {
    if (conn.alpha <= 0) continue;
    ctx.globalAlpha = conn.alpha * 0.35;
    ctx.strokeStyle = conn.color || C.rule;
    ctx.lineWidth = conn.width || 1;
    if (conn.dash) ctx.setLineDash(conn.dash);
    ctx.beginPath();
    ctx.moveTo(conn.x1, conn.y1);
    ctx.lineTo(conn.x2, conn.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

function fadeConns(connections: Connection[]) {
  for (const c of connections) {
    if (c.targetAlpha !== undefined && c.alpha < c.targetAlpha) {
      c.alpha = Math.min(c.targetAlpha, c.alpha + 0.03);
    }
  }
}

function getAct(t: number): number {
  const lt = t % LOOP;
  for (let i = 0; i < ACTS.length; i++) {
    if (lt >= ACTS[i].start && lt < ACTS[i].end) return i;
  }
  return 0;
}

// ── Act implementations ──

function act0(
  W: number,
  H: number,
  entities: Entity[],
  scheduled: Record<string, boolean>,
) {
  if (scheduled.a0) return;
  scheduled.a0 = true;
  for (let i = 0; i < 10; i++) {
    entities.push(
      new Entity(L.prdX * W * 0.25 + Math.random() * W * 0.06, L.mainY * H + (Math.random() - 0.5) * H * 0.75, {
        tx: L.prdX * W,
        ty: L.mainY * H,
        r: 3 + Math.random() * 2,
        color: C.chaos,
        wash: C.chaosFade,
        shape: "circle",
        type: "chaos",
        easing: 0.02 + Math.random() * 0.02,
        maxTrail: 12,
        delay: i * 0.05,
      }),
    );
  }
}

function act1(
  W: number,
  H: number,
  entities: Entity[],
  connections: Connection[],
  scheduled: Record<string, boolean>,
) {
  if (scheduled.a1) return;
  scheduled.a1 = true;
  entities.forEach((e) => { if (e.type === "chaos") e.kill(); });

  entities.push(
    new Entity(L.prdX * W, L.mainY * H, {
      r: 8, color: C.accent, wash: C.accentFade,
      shape: "circle", type: "prd", label: "PRD", maxTrail: 0,
    }),
  );

  connections.push({
    x1: L.prdX * W + 14, y1: L.mainY * H,
    x2: L.decompX * W - 14, y2: L.mainY * H,
    color: C.accent, alpha: 0, width: 1, targetAlpha: 1,
  });

  for (let i = 0; i < 3; i++) {
    entities.push(
      new Entity(L.decompX * W, L.mainY * H, {
        tx: L.issueStartX * W, ty: L.issueLanes[i] * H,
        r: 5.5, color: C.accent, wash: C.accentFade,
        shape: "circle", type: "issue", label: `#${i + 1}`,
        easing: 0.05, maxTrail: 14,
        delay: 0.25 + i * 0.18,
      }),
    );

    if (i === 2) {
      setTimeout(() => {
        connections.push({
          x1: L.issueStartX * W, y1: L.issueLanes[0] * H + 8,
          x2: L.issueStartX * W, y2: L.issueLanes[2] * H - 8,
          color: C.ink4, alpha: 0, width: 0.75, dash: [3, 4], targetAlpha: 0.6,
        });
      }, 600);
    }
  }
}

function act2(
  W: number,
  H: number,
  entities: Entity[],
  connections: Connection[],
  scheduled: Record<string, boolean>,
) {
  if (scheduled.a2) return;
  scheduled.a2 = true;

  entities.push(
    new Entity(L.reviewX * W, L.reviewY * H, {
      r: 9, color: C.accent, wash: C.accentFade,
      shape: "diamond", type: "review", label: "BOT REVIEW", maxTrail: 0,
    }),
  );
  entities.push(
    new Entity(L.policyX * W, L.policyY * H, {
      r: 7, color: C.policy, wash: C.policyFade,
      shape: "diamond", type: "policy", label: "POLICY", maxTrail: 0, delay: 0.15,
    }),
  );
  connections.push({
    x1: L.reviewX * W, y1: L.reviewY * H - 14,
    x2: L.policyX * W, y2: L.policyY * H + 12,
    color: C.policy, alpha: 0, width: 0.75, dash: [3, 4], targetAlpha: 0.5,
  });

  const items = [
    { num: 1, lane: 0, start: 0.05, prDelay: 0.6, prType: "pr-1", prLabel: "PR" },
    { num: 2, lane: 1, start: 1.1, prDelay: 1.7, prType: "pr-2", prLabel: "" },
  ];

  for (const item of items) {
    const iy = L.issueLanes[item.lane] * H;

    setTimeout(() => {
      const issue = entities.find((e) => e.type === "issue" && e.label === `#${item.num}`);
      if (issue) {
        issue.moveTo(L.buildX * W, iy, 0.05);
        issue.label = "";
        for (let j = 0; j < 3; j++) {
          entities.push(
            new Entity(L.buildX * W, iy, {
              tx: L.buildX * W + 14 + j * 10, ty: iy + (Math.random() - 0.5) * 12,
              r: 2, color: C.ink4, wash: "rgba(0,0,0,0)",
              shape: "circle", type: "agent-work", easing: 0.07, maxTrail: 5, delay: 0.2 + j * 0.15,
            }),
          );
        }
      }
    }, item.start * 1000);

    setTimeout(() => {
      entities.push(
        new Entity(L.buildX * W + 18, iy, {
          tx: L.prX * W, ty: iy,
          r: 5.5, color: C.accent, wash: C.accentFade,
          shape: "rect", type: item.prType, label: item.prLabel, easing: 0.045, maxTrail: 16,
        }),
      );
    }, item.prDelay * 1000);

    setTimeout(() => {
      const issue = entities.find(
        (e) => e.type === "issue" && e.x > L.buildX * W - 30 && Math.abs(e.y - iy) < 10,
      );
      if (issue) issue.kill();
    }, (item.prDelay + 0.25) * 1000);
  }
}

function act3(
  W: number,
  H: number,
  entities: Entity[],
  connections: Connection[],
  scheduled: Record<string, boolean>,
) {
  if (scheduled.a3) return;
  scheduled.a3 = true;

  entities.filter((e) => e.type === "agent-work").forEach((e) => e.kill());

  entities.push(
    new Entity(L.deployX * W, L.deployY * H, {
      r: 10, color: C.good, wash: C.goodFade,
      shape: "terminal", type: "deploy", label: "DEPLOY", maxTrail: 0,
    }),
  );
  connections.push({
    x1: L.reviewX * W + 14, y1: L.reviewY * H,
    x2: L.deployX * W - 20, y2: L.deployY * H,
    color: C.good, alpha: 0, width: 1, targetAlpha: 0.5,
  });

  const pr1 = entities.find((e) => e.type === "pr-1");
  if (pr1) {
    pr1.moveTo(L.reviewX * W, L.reviewY * H, 0.06);
    setTimeout(() => { pr1.moveTo(L.deployX * W, L.deployY * H, 0.06); pr1.shape = "circle"; pr1.r = 4; pr1.label = ""; }, 350);
    setTimeout(() => pr1.kill(), 800);
  }

  const pr2 = entities.find((e) => e.type === "pr-2");
  if (pr2) {
    setTimeout(() => pr2.moveTo(L.reviewX * W, L.reviewY * H, 0.06), 350);
    setTimeout(() => {
      entities.push(new Entity(L.reviewX * W, L.reviewY * H - 2, {
        tx: L.policyX * W, ty: L.policyY * H + 10,
        r: 3, color: C.policy, wash: C.policyFade,
        shape: "circle", type: "policy-check", maxTrail: 12, easing: 0.07,
      }));
    }, 600);
    setTimeout(() => {
      entities.push(new Entity(L.policyX * W, L.policyY * H + 10, {
        tx: L.reviewX * W, ty: L.reviewY * H - 2,
        r: 3, color: C.policy, wash: C.policyFade,
        shape: "circle", type: "policy-return", maxTrail: 12, easing: 0.07,
      }));
    }, 850);
    setTimeout(() => { pr2.moveTo(L.deployX * W, L.deployY * H, 0.06); pr2.shape = "circle"; pr2.r = 4; pr2.label = ""; }, 1100);
    setTimeout(() => pr2.kill(), 1500);
  }
}

function act4(
  W: number,
  H: number,
  entities: Entity[],
  connections: Connection[],
  scheduled: Record<string, boolean>,
) {
  if (scheduled.a4) return;
  scheduled.a4 = true;

  const deploy = entities.find((e) => e.type === "deploy");
  if (deploy) { deploy.color = C.heal; deploy.wash = C.healFade; }

  entities.push(new Entity(L.deployX * W, L.deployY * H + 14, {
    tx: L.deployX * W, ty: L.monitorY * H,
    r: 5.5, color: C.heal, wash: C.healFade,
    shape: "circle", type: "failure", label: "FAIL", easing: 0.07, maxTrail: 16,
  }));

  setTimeout(() => {
    entities.push(new Entity(L.deployX * W, L.monitorY * H, {
      tx: L.healReturnX * W, ty: L.monitorY * H,
      r: 5.5, color: C.heal, wash: C.healFade,
      shape: "circle", type: "bug-issue", label: "BUG", easing: 0.055, maxTrail: 18,
    }));
    connections.push({
      x1: L.deployX * W, y1: L.monitorY * H,
      x2: L.healReturnX * W, y2: L.monitorY * H,
      color: C.heal, alpha: 0, width: 1, dash: [4, 4], targetAlpha: 0.4,
    });
  }, 400);

  setTimeout(() => {
    const bug = entities.find((e) => e.type === "bug-issue");
    if (bug) bug.moveTo(L.buildX * W, L.mainY * H, 0.06);
  }, 800);

  setTimeout(() => {
    entities.push(new Entity(L.buildX * W, L.mainY * H, {
      tx: L.reviewX * W, ty: L.reviewY * H,
      r: 5.5, color: C.heal, wash: C.healFade,
      shape: "rect", type: "fix-pr", label: "FIX", easing: 0.055, maxTrail: 18,
    }));
  }, 1100);

  setTimeout(() => {
    const fixPr = entities.find((e) => e.type === "fix-pr");
    if (fixPr) fixPr.moveTo(L.deployX * W, L.deployY * H, 0.06);
  }, 1500);

  setTimeout(() => {
    const d = entities.find((e) => e.type === "deploy");
    if (d) { d.color = C.good; d.wash = C.goodFade; }
    for (const t of ["failure", "bug-issue", "fix-pr", "policy-check", "policy-return"]) {
      entities.filter((e) => e.type === t).forEach((e) => e.kill());
    }
  }, 1850);
}

// ── Component ──

export function PipelineAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let W = 0;
    let H = 0;

    function resize() {
      const r = canvas!.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    let time = 0;
    let lastFrame = performance.now();
    let entities: Entity[] = [];
    let connections: Connection[] = [];
    let scheduled: Record<string, boolean> = {};
    let raf: number;

    function frame(now: number) {
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      time += dt;

      const lt = time % LOOP;
      const act = getAct(time);

      // Reset on loop
      if (lt < dt * 2 && time > 1) {
        entities = [];
        connections = [];
        scheduled = {};
      }

      if (act >= 0) act0(W, H, entities, scheduled);
      if (act >= 1) { act1(W, H, entities, connections, scheduled); fadeConns(connections); }
      if (act >= 2) { act2(W, H, entities, connections, scheduled); fadeConns(connections); }
      if (act >= 3) { act3(W, H, entities, connections, scheduled); fadeConns(connections); }
      if (act >= 4) { act4(W, H, entities, connections, scheduled); fadeConns(connections); }

      entities.forEach((e) => e.update(dt, time));
      entities = entities.filter((e) => !e.dead);

      ctx!.save();
      ctx!.scale(dpr, dpr);
      ctx!.clearRect(0, 0, W, H);

      // Faint main lane
      ctx!.strokeStyle = C.rule;
      ctx!.lineWidth = 0.5;
      ctx!.globalAlpha = 0.4;
      ctx!.beginPath();
      ctx!.moveTo(W * 0.03, L.mainY * H);
      ctx!.lineTo(W * 0.97, L.mainY * H);
      ctx!.stroke();
      ctx!.globalAlpha = 1;

      drawConnections(ctx!, connections);
      entities.forEach((e) => e.draw(ctx!, time));

      ctx!.restore();

      // Update act strip
      if (chipsRef.current) {
        const chips = chipsRef.current.children;
        for (let i = 0; i < chips.length; i++) {
          const el = chips[i] as HTMLElement;
          el.classList.remove(styles.active, styles.healActive);
          if (i === act) el.classList.add(i === 4 ? styles.healActive : styles.active);
        }
      }

      raf = requestAnimationFrame(frame);
    }

    // Wait for fonts
    document.fonts.ready.then(() => {
      raf = requestAnimationFrame(frame);
    });

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.strip} ref={chipsRef}>
        {ACT_NAMES.map((name, i) => (
          <div key={name} className={styles.chip} data-act={i}>
            <span className={styles.chipTitle}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
