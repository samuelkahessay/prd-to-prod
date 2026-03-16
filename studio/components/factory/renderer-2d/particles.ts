interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  type: "dust" | "confetti" | "code" | "steam" | "sparkle";
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private reducedMotion = false;

  constructor() {
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  emitDust(x: number, y: number, count = 1) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + rand(-40, 40),
        y: y + rand(-30, 30),
        vx: rand(-3, 3),
        vy: rand(-4, -1),
        life: 0,
        maxLife: rand(6, 12),
        size: rand(1, 2.5),
        color: "#d4a574",
        rotation: 0,
        rotSpeed: 0,
        type: "dust",
      });
    }
  }

  emitConfetti(x: number, y: number, count = 40) {
    if (this.reducedMotion) return;
    const colors = ["#4a6fd8", "#3d9a6a", "#9b7ed8", "#c45a3c", "#ffd700", "#e8c547"];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + rand(-20, 20),
        y: y + rand(-10, 10),
        vx: rand(-60, 60),
        vy: rand(-120, -40),
        life: 0,
        maxLife: rand(2, 4),
        size: rand(3, 6),
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: rand(0, Math.PI * 2),
        rotSpeed: rand(-8, 8),
        type: "confetti",
      });
    }
  }

  emitCode(x: number, y: number, color: string) {
    if (this.reducedMotion) return;
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + rand(-8, 8),
        y: y + rand(-5, 5),
        vx: rand(-5, 5),
        vy: rand(-15, -5),
        life: 0,
        maxLife: rand(1, 2),
        size: rand(2, 4),
        color,
        rotation: 0,
        rotSpeed: 0,
        type: "code",
      });
    }
  }

  emitSteam(x: number, y: number, count = 2) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + rand(-3, 3),
        y,
        vx: rand(-2, 2),
        vy: rand(-8, -3),
        life: 0,
        maxLife: rand(2, 4),
        size: rand(2, 4),
        color: "rgba(255,255,255,0.5)",
        rotation: 0,
        rotSpeed: 0,
        type: "steam",
      });
    }
  }

  emitSparkle(x: number, y: number, count = 6) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * rand(20, 50),
        vy: Math.sin(angle) * rand(20, 50),
        life: 0,
        maxLife: rand(0.4, 0.8),
        size: rand(2, 4),
        color: "#ffd700",
        rotation: 0,
        rotSpeed: 0,
        type: "sparkle",
      });
    }
  }

  update(deltaTime: number) {
    if (this.reducedMotion) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaTime;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.rotation += p.rotSpeed * deltaTime;

      // Gravity for confetti
      if (p.type === "confetti") {
        p.vy += 80 * deltaTime;
        p.vx *= 0.98;
      }

      // Steam rises and spreads
      if (p.type === "steam") {
        p.vx += Math.sin(p.life * 3) * 2 * deltaTime;
        p.size += deltaTime * 1.5;
      }

      // Dust drifts slowly
      if (p.type === "dust") {
        p.vx += Math.sin(p.life * 0.5 + p.x * 0.01) * 0.5 * deltaTime;
        p.vy += Math.cos(p.life * 0.3) * 0.3 * deltaTime;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.reducedMotion) return;

    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);

      switch (p.type) {
        case "dust":
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha * 0.3;
          ctx.fill();
          break;

        case "confetti":
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -1, p.size, 2.5);
          break;

        case "code":
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillRect(-p.size / 2, -1, p.size, 2);
          break;

        case "steam":
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.globalAlpha = alpha * 0.4;
          ctx.fill();
          break;

        case "sparkle": {
          ctx.fillStyle = p.color;
          // Draw a 4-pointed star
          const r = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.3, -r * 0.3);
          ctx.lineTo(r, 0);
          ctx.lineTo(r * 0.3, r * 0.3);
          ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.3, r * 0.3);
          ctx.lineTo(-r, 0);
          ctx.lineTo(-r * 0.3, -r * 0.3);
          ctx.closePath();
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    }
  }

  get count() {
    return this.particles.length;
  }
}
