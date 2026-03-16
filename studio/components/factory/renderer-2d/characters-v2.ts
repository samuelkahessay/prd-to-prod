import type { AgentId, CharacterState } from "../factory-types";
import type { IdleState } from "./idle-behaviors";

// ── Skin tones ────────────────────────────────────────────

const SKIN: Record<string, { base: string; shadow: string }> = {
  light: { base: "#f0d5b8", shadow: "#dbb896" },
  medium: { base: "#c68642", shadow: "#a86e35" },
  brown: { base: "#8d5524", shadow: "#6e4220" },
  dark: { base: "#5c3a1e", shadow: "#4a2e17" },
  olive: { base: "#d4a574", shadow: "#b8895e" },
};

// ── Character definitions ─────────────────────────────────

interface CharacterDef {
  build: "tall" | "stocky" | "medium" | "compact" | "athletic";
  shoulderW: number;  // relative to scale
  torsoH: number;
  legH: number;
  headR: number;
  skin: keyof typeof SKIN;
  clothing: { main: string; accent: string; detail: string };
  hair: { color: string; style: string };
  eyeReflect: string;
  accessory: string;
}

const DEFS: Record<AgentId, CharacterDef> = {
  planner: {
    build: "tall",
    shoulderW: 4.5,
    torsoH: 7,
    legH: 3,
    headR: 4.5,
    skin: "dark",
    clothing: { main: "#4a6fd8", accent: "#f5f3f0", detail: "#3a5ab8" },
    hair: { color: "#1a1a1a", style: "side-part" },
    eyeReflect: "#f5deb3",
    accessory: "glasses",
  },
  developer: {
    build: "stocky",
    shoulderW: 6,
    torsoH: 5.5,
    legH: 2.5,
    headR: 5,
    skin: "medium",
    clothing: { main: "#2d2d2d", accent: "#444", detail: "#555" },
    hair: { color: "#1a1a1a", style: "buzz-fade" },
    eyeReflect: "#61afef",
    accessory: "headphones",
  },
  "frontend-designer": {
    build: "medium",
    shoulderW: 5,
    torsoH: 6,
    legH: 2.5,
    headR: 4.8,
    skin: "olive",
    clothing: { main: "#9b7ed8", accent: "#e8c547", detail: "#c4b0f0" },
    hair: { color: "#1a1a1a", style: "flowing-beret" },
    eyeReflect: "#9b7ed8",
    accessory: "beret-earring",
  },
  reviewer: {
    build: "compact",
    shoulderW: 4,
    torsoH: 5,
    legH: 2,
    headR: 5,
    skin: "brown",
    clothing: { main: "#3d3d3d", accent: "#f5f3f0", detail: "#555" },
    hair: { color: "#2d1f1a", style: "crown-curls" },
    eyeReflect: "#98c379",
    accessory: "pocket-square",
  },
  deployer: {
    build: "athletic",
    shoulderW: 5.5,
    torsoH: 6.5,
    legH: 3,
    headR: 4.5,
    skin: "light",
    clothing: { main: "#3d9a6a", accent: "#2d7a54", detail: "#4aaa7a" },
    hair: { color: "#3a2a1e", style: "pompadour" },
    eyeReflect: "#d46a4c",
    accessory: "headset",
  },
};

// ── Draw opts ─────────────────────────────────────────────

export interface DrawOpts {
  x: number;
  y: number;
  scale: number;
  state: CharacterState;
  time: number;
  agentId: AgentId;
  facing?: "left" | "right";
  idle?: IdleState | null;
  walking?: boolean;
}

// ── Main draw function ────────────────────────────────────

export function drawCharacter(ctx: CanvasRenderingContext2D, opts: DrawOpts) {
  const { x, y, scale: s, state, time, agentId, facing = "right", idle, walking } = opts;
  const def = DEFS[agentId];
  const skin = SKIN[def.skin];

  const sw = def.shoulderW * s;
  const th = def.torsoH * s;
  const lh = def.legH * s;
  const hr = def.headR * s;

  ctx.save();
  ctx.translate(x, y);
  if (facing === "left") ctx.scale(-1, 1);

  // Animation
  const breathe = Math.sin(time * 2) * s * 0.4;
  const bounce = state === "celebrating" ? Math.abs(Math.sin(time * 6)) * s * 6 : 0;
  const baseY = -bounce;

  // ── Shadow ──
  ctx.beginPath();
  ctx.ellipse(0, s * 1.5, sw + s, s * 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fill();

  // ── Legs ──
  const legSpread = state === "celebrating" ? Math.sin(time * 6) * s * 2 : 0;
  const walkPhase = walking ? Math.sin(time * 8) * s * 2 : 0;

  ctx.lineCap = "round";
  ctx.lineWidth = s * 2;
  ctx.strokeStyle = "#555";

  // Left leg
  ctx.beginPath();
  ctx.moveTo(-s * 2 - legSpread, baseY - lh * 0.2);
  ctx.lineTo(-s * 2.5 - legSpread + walkPhase, baseY + lh * 0.8);
  ctx.stroke();

  // Right leg
  ctx.beginPath();
  ctx.moveTo(s * 2 + legSpread, baseY - lh * 0.2);
  ctx.lineTo(s * 2.5 + legSpread - walkPhase, baseY + lh * 0.8);
  ctx.stroke();

  // Shoes
  ctx.fillStyle = agentId === "deployer" ? "#5a4a3a" : "#333";
  ctx.beginPath();
  ctx.ellipse(-s * 2.5 - legSpread + walkPhase, baseY + lh, s * 2.2, s * 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 2.5 + legSpread - walkPhase, baseY + lh, s * 2.2, s * 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Body + Arms (continuous) ──
  const torsoTop = baseY - lh - th + breathe;
  const torsoBot = baseY - lh * 0.2;
  drawBodyAndArms(ctx, def, skin, s, sw, torsoTop, torsoBot, state, time, idle);

  // ── Clothing details ──
  drawClothingDetails(ctx, def, s, sw, torsoTop, torsoBot, agentId);

  // ── Head ──
  const headY = torsoTop - hr * 0.8;
  const headTilt = state === "reviewing" ? Math.sin(time * 1.5) * 0.05 : 0;

  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(headTilt);

  // Neck
  ctx.fillStyle = skin.shadow;
  ctx.fillRect(-s * 1.2, hr * 0.3, s * 2.4, hr * 0.5);

  // Head shape
  ctx.beginPath();
  ctx.ellipse(0, 0, hr, hr * 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.base;
  ctx.fill();

  // Hair
  drawHair(ctx, def, s, hr);

  // Face
  drawFace(ctx, def, s, hr, state, time, agentId);

  // Head accessories
  drawHeadAccessory(ctx, def, s, hr, state, time);

  ctx.restore(); // head

  ctx.restore(); // main
}

// ── Body + Arms ───────────────────────────────────────────

function drawBodyAndArms(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  skin: { base: string; shadow: string },
  s: number,
  sw: number,
  torsoTop: number,
  torsoBot: number,
  state: CharacterState,
  time: number,
  idle: IdleState | null | undefined
) {
  // Torso
  ctx.beginPath();
  ctx.moveTo(-sw * 0.65, torsoBot);
  ctx.bezierCurveTo(
    -sw * 0.8, torsoBot - (torsoBot - torsoTop) * 0.3,
    -sw * 1.05, torsoTop + 2,
    -sw * 0.3, torsoTop - 1
  );
  ctx.lineTo(sw * 0.3, torsoTop - 1);
  ctx.bezierCurveTo(
    sw * 1.05, torsoTop + 2,
    sw * 0.8, torsoBot - (torsoBot - torsoTop) * 0.3,
    sw * 0.65, torsoBot
  );
  ctx.closePath();
  ctx.fillStyle = def.clothing.main;
  ctx.fill();

  // Collar/accent
  ctx.beginPath();
  ctx.moveTo(-s * 1.8, torsoTop + 2);
  ctx.lineTo(-s * 0.8, torsoTop + (torsoBot - torsoTop) * 0.25);
  ctx.lineTo(s * 0.8, torsoTop + (torsoBot - torsoTop) * 0.25);
  ctx.lineTo(s * 1.8, torsoTop + 2);
  ctx.closePath();
  ctx.fillStyle = def.clothing.accent;
  ctx.fill();

  // Arms — thick strokes from shoulders, color-matched to body
  const armStartY = torsoTop + 3;
  ctx.lineWidth = s * 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = def.clothing.main;

  if (state === "working") {
    const typL = Math.sin(time * 12) * s * 1.5;
    const typR = Math.sin(time * 12 + 1) * s * 1.5;

    // Left arm forward
    ctx.beginPath();
    ctx.moveTo(-sw, armStartY);
    ctx.quadraticCurveTo(-sw * 0.8, armStartY + s * 5, -s * 2 + typL, armStartY + s * 6);
    ctx.stroke();

    // Right arm forward
    ctx.beginPath();
    ctx.moveTo(sw, armStartY);
    ctx.quadraticCurveTo(sw * 0.8, armStartY + s * 5, s * 2 + typR, armStartY + s * 6);
    ctx.stroke();

    // Hands
    ctx.fillStyle = skin.base;
    drawCircle(ctx, -s * 2 + typL, armStartY + s * 6, s * 1.4);
    drawCircle(ctx, s * 2 + typR, armStartY + s * 6, s * 1.4);

  } else if (state === "celebrating") {
    const wave = Math.sin(time * 8) * s * 2;

    ctx.beginPath();
    ctx.moveTo(-sw, armStartY);
    ctx.quadraticCurveTo(-sw * 1.3, armStartY - s * 5, -sw + wave, armStartY - s * 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sw, armStartY);
    ctx.quadraticCurveTo(sw * 1.3, armStartY - s * 5, sw - wave, armStartY - s * 10);
    ctx.stroke();

    ctx.fillStyle = skin.base;
    drawCircle(ctx, -sw + wave, armStartY - s * 10, s * 1.4);
    drawCircle(ctx, sw - wave, armStartY - s * 10, s * 1.4);

  } else if (state === "blocked") {
    // Arms crossed
    ctx.beginPath();
    ctx.moveTo(-sw, armStartY);
    ctx.quadraticCurveTo(-sw * 0.4, armStartY + s * 3.5, sw * 0.4, armStartY + s * 2.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sw, armStartY);
    ctx.quadraticCurveTo(sw * 0.4, armStartY + s * 3.5, -sw * 0.4, armStartY + s * 2.5);
    ctx.stroke();

  } else {
    // Idle — arms at sides with optional behavior animation
    let leftHandX = -sw - s * 0.5;
    let leftHandY = armStartY + s * 7;
    let rightHandX = sw + s * 0.5;
    let rightHandY = armStartY + s * 7;

    const sway = Math.sin(time * 1.5) * s * 0.6;
    leftHandX += sway;
    rightHandX -= sway;

    // Idle behavior modifications
    if (idle) {
      const p = idle.progress;
      const ease = Math.sin(p * Math.PI); // bell curve 0→1→0

      switch (idle.behavior) {
        case "sip_coffee":
        case "check_whiteboard":
          // Right arm raises
          rightHandX = sw * 0.3;
          rightHandY = armStartY + s * 2 - ease * s * 4;
          break;
        case "stretch":
          // Both arms up
          leftHandY -= ease * s * 10;
          rightHandY -= ease * s * 10;
          leftHandX -= ease * s * 2;
          rightHandX += ease * s * 2;
          break;
        case "check_phone":
        case "review_notes":
          // Right arm raised to face
          rightHandX = sw * 0.2;
          rightHandY = armStartY - ease * s * 3;
          break;
        case "scratch_head":
        case "adjust_headphones":
          // Right hand to head
          rightHandX = s * 1;
          rightHandY = armStartY - ease * s * 8;
          break;
        case "look_around":
        case "examine_swatches":
        case "check_monitors":
          // Subtle shift, handled by head rotation
          break;
        case "lean_back":
          // Arms slightly back
          leftHandX -= ease * s * 2;
          rightHandX += ease * s * 2;
          break;
      }
    }

    // Left arm
    ctx.beginPath();
    ctx.moveTo(-sw, armStartY);
    ctx.quadraticCurveTo(-sw * 1.1, armStartY + s * 4, leftHandX, leftHandY);
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(sw, armStartY);
    ctx.quadraticCurveTo(sw * 1.1, armStartY + s * 4, rightHandX, rightHandY);
    ctx.stroke();

    // Hands
    ctx.fillStyle = skin.base;
    drawCircle(ctx, leftHandX, leftHandY, s * 1.4);
    drawCircle(ctx, rightHandX, rightHandY, s * 1.4);
  }
}

// ── Clothing details ──────────────────────────────────────

function drawClothingDetails(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  s: number,
  sw: number,
  torsoTop: number,
  torsoBot: number,
  agentId: AgentId
) {
  const midY = (torsoTop + torsoBot) / 2;

  switch (agentId) {
    case "planner":
      // Vest buttons (2 small circles)
      ctx.fillStyle = def.clothing.detail;
      drawCircle(ctx, 0, midY - s * 1, s * 0.5);
      drawCircle(ctx, 0, midY + s * 1.5, s * 0.5);
      break;

    case "developer":
      // Hoodie kangaroo pocket
      ctx.strokeStyle = def.clothing.detail;
      ctx.lineWidth = s * 0.4;
      ctx.beginPath();
      ctx.roundRect(-sw * 0.4, midY + s * 1, sw * 0.8, (torsoBot - midY) * 0.5, s * 0.5);
      ctx.stroke();
      // Hoodie strings
      ctx.strokeStyle = "#666";
      ctx.lineWidth = s * 0.3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, torsoTop + s * 2);
      ctx.lineTo(-s * 0.6, torsoTop + s * 5);
      ctx.moveTo(s * 0.5, torsoTop + s * 2);
      ctx.lineTo(s * 0.6, torsoTop + s * 5);
      ctx.stroke();
      break;

    case "frontend-designer":
      // Yellow scarf
      ctx.fillStyle = def.clothing.accent;
      ctx.beginPath();
      ctx.moveTo(-s * 1.5, torsoTop + s * 1);
      ctx.quadraticCurveTo(-s * 2, torsoTop + s * 4, -sw * 0.3, midY + s * 3);
      ctx.lineTo(-sw * 0.1, midY + s * 2);
      ctx.quadraticCurveTo(-s * 1.2, torsoTop + s * 3, -s * 0.8, torsoTop + s * 1);
      ctx.closePath();
      ctx.fill();
      // Scarf tail
      ctx.beginPath();
      ctx.moveTo(s * 0.8, torsoTop + s * 1.5);
      ctx.quadraticCurveTo(s * 1.5, torsoTop + s * 5, s * 0.5, midY + s * 4);
      ctx.strokeStyle = def.clothing.accent;
      ctx.lineWidth = s * 1.5;
      ctx.stroke();
      break;

    case "reviewer":
      // Lapels
      ctx.strokeStyle = def.clothing.detail;
      ctx.lineWidth = s * 0.5;
      ctx.beginPath();
      ctx.moveTo(-s * 1, torsoTop + s * 1);
      ctx.lineTo(-s * 0.3, midY);
      ctx.moveTo(s * 1, torsoTop + s * 1);
      ctx.lineTo(s * 0.3, midY);
      ctx.stroke();
      // Pocket square
      ctx.fillStyle = def.clothing.accent;
      ctx.fillRect(sw * 0.3, torsoTop + s * 3, s * 2, s * 1.5);
      break;

    case "deployer":
      // Bomber zipper line
      ctx.strokeStyle = "#666";
      ctx.lineWidth = s * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, torsoTop + s * 2);
      ctx.lineTo(0, torsoBot - s * 1);
      ctx.stroke();
      // Mission patch (left chest)
      ctx.fillStyle = "#e8c547";
      ctx.beginPath();
      ctx.arc(-sw * 0.4, torsoTop + s * 4, s * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c4a030";
      ctx.lineWidth = s * 0.3;
      ctx.stroke();
      break;
  }
}

// ── Hair ──────────────────────────────────────────────────

function drawHair(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  s: number,
  hr: number
) {
  ctx.fillStyle = def.hair.color;

  switch (def.hair.style) {
    case "side-part":
      // Volume on top swept to one side
      ctx.beginPath();
      ctx.ellipse(0, -hr * 0.4, hr * 1.05, hr * 0.8, 0, Math.PI, 0);
      ctx.fill();
      // Part line
      ctx.beginPath();
      ctx.moveTo(-hr * 0.5, -hr * 1.1);
      ctx.quadraticCurveTo(hr * 0.2, -hr * 1.3, hr * 0.8, -hr * 0.7);
      ctx.lineWidth = s * 1;
      ctx.strokeStyle = def.hair.color;
      ctx.stroke();
      break;

    case "buzz-fade":
      // Very short, tapers at sides
      ctx.beginPath();
      ctx.ellipse(0, -hr * 0.3, hr * 1, hr * 0.85, 0, Math.PI + 0.3, -0.3);
      ctx.fill();
      // Fade lines at sides
      ctx.strokeStyle = def.hair.color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = s * 0.3;
      for (let i = 0; i < 3; i++) {
        const fy = -hr * 0.1 + i * s * 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, hr * (0.95 - i * 0.05), Math.PI * 0.85 + i * 0.05, Math.PI * 0.15 - i * 0.05);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;

    case "flowing-beret":
      // Long flowing hair on sides
      ctx.beginPath();
      ctx.ellipse(0, -hr * 0.4, hr * 1.1, hr * 0.9, 0, Math.PI, 0);
      ctx.fill();
      // Side hair flowing down
      ctx.fillRect(-hr * 1.1, -hr * 0.4, s * 1.8, hr * 1.6);
      ctx.fillRect(hr * 1.1 - s * 1.8, -hr * 0.4, s * 1.8, hr * 1.6);
      // Beret on top
      ctx.fillStyle = "#9b7ed8";
      ctx.beginPath();
      ctx.ellipse(-s * 0.8, -hr * 1, hr * 1, hr * 0.45, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.8, -hr * 1.4, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "crown-curls":
      // Tight curls in a crown formation
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI + (i / 7) * Math.PI;
        const cx = Math.cos(angle) * hr * 1.05;
        const cy = Math.sin(angle) * hr * 1.05 - hr * 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Top crown
      for (let i = 0; i < 5; i++) {
        const angle = Math.PI * 1.15 + (i / 4) * Math.PI * 0.7;
        const cx = Math.cos(angle) * hr * 0.7;
        const cy = Math.sin(angle) * hr * 0.7 - hr * 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case "pompadour":
      // High volume on top, shorter sides
      ctx.beginPath();
      ctx.ellipse(0, -hr * 0.5, hr * 1.05, hr * 0.75, 0, Math.PI, 0);
      ctx.fill();
      // Pompadour volume
      ctx.beginPath();
      ctx.moveTo(-hr * 0.5, -hr * 1.1);
      ctx.bezierCurveTo(
        -hr * 0.2, -hr * 1.7,
        hr * 0.5, -hr * 1.6,
        hr * 0.7, -hr * 0.9
      );
      ctx.lineTo(hr * 0.3, -hr * 0.8);
      ctx.bezierCurveTo(
        hr * 0.1, -hr * 1.2,
        -hr * 0.1, -hr * 1.3,
        -hr * 0.4, -hr * 0.9
      );
      ctx.closePath();
      ctx.fill();
      break;
  }
}

// ── Face ──────────────────────────────────────────────────

function drawFace(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  s: number,
  hr: number,
  state: CharacterState,
  time: number,
  agentId: AgentId
) {
  const eyeY = hr * 0.05;
  const eyeSpread = hr * 0.38;
  const blinkCycle = Math.floor(time * 0.5) % 5 === 0 && Math.sin(time * 20) > 0.8;

  // Eyes
  if (blinkCycle) {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = s * 0.6;
    ctx.beginPath();
    ctx.moveTo(-eyeSpread - s * 0.6, eyeY);
    ctx.lineTo(-eyeSpread + s * 0.6, eyeY);
    ctx.moveTo(eyeSpread - s * 0.6, eyeY);
    ctx.lineTo(eyeSpread + s * 0.6, eyeY);
    ctx.stroke();
  } else {
    // Eye whites
    ctx.fillStyle = "#fff";
    drawCircle(ctx, -eyeSpread, eyeY, s * 1.1);
    drawCircle(ctx, eyeSpread, eyeY, s * 1.1);

    // Pupils
    const squint = agentId === "developer" ? 0.7 : 1;
    ctx.fillStyle = "#222";
    drawCircle(ctx, -eyeSpread, eyeY, s * 0.8 * squint);
    drawCircle(ctx, eyeSpread, eyeY, s * 0.8 * squint);

    // Catchlight (monitor reflection color)
    ctx.fillStyle = def.eyeReflect;
    ctx.globalAlpha = 0.6;
    drawCircle(ctx, -eyeSpread + s * 0.25, eyeY - s * 0.25, s * 0.3);
    drawCircle(ctx, eyeSpread + s * 0.25, eyeY - s * 0.25, s * 0.3);
    ctx.globalAlpha = 1;
  }

  // Eyebrows (character-specific)
  ctx.strokeStyle = def.hair.color;
  ctx.lineWidth = s * 0.5;
  const browY = eyeY - s * 1.8;

  if (agentId === "planner") {
    // One raised brow
    ctx.beginPath();
    ctx.moveTo(-eyeSpread - s, browY);
    ctx.lineTo(-eyeSpread + s, browY - s * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeSpread - s, browY);
    ctx.lineTo(eyeSpread + s, browY);
    ctx.stroke();
  } else if (agentId === "reviewer") {
    // One brow up (knowing)
    ctx.beginPath();
    ctx.moveTo(-eyeSpread - s, browY);
    ctx.lineTo(-eyeSpread + s, browY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeSpread - s, browY - s * 0.6);
    ctx.lineTo(eyeSpread + s, browY);
    ctx.stroke();
  } else {
    // Standard brows
    ctx.beginPath();
    ctx.moveTo(-eyeSpread - s, browY);
    ctx.lineTo(-eyeSpread + s, browY);
    ctx.moveTo(eyeSpread - s, browY);
    ctx.lineTo(eyeSpread + s, browY);
    ctx.stroke();
  }

  // Nose (tiny)
  ctx.fillStyle = SKIN[def.skin].shadow;
  ctx.beginPath();
  ctx.arc(0, eyeY + s * 1.5, s * 0.5, 0, Math.PI);
  ctx.fill();

  // Mouth (state + character dependent)
  const mouthY = eyeY + s * 3;

  if (state === "celebrating") {
    // Big smile, teeth
    ctx.beginPath();
    ctx.arc(0, mouthY, s * 1.5, 0.1, Math.PI - 0.1);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = s * 0.5;
    ctx.stroke();
  } else if (state === "blocked") {
    // Frown
    ctx.beginPath();
    ctx.arc(0, mouthY + s * 1, s * 1, Math.PI + 0.3, -0.3);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = s * 0.5;
    ctx.stroke();
  } else {
    // Character-specific default expression
    switch (agentId) {
      case "planner":
        // Half-smile
        ctx.beginPath();
        ctx.arc(s * 0.3, mouthY, s * 1, 0.2, Math.PI - 0.5);
        ctx.strokeStyle = "#555";
        ctx.lineWidth = s * 0.4;
        ctx.stroke();
        break;
      case "developer":
        // Neutral focused
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, mouthY);
        ctx.lineTo(s * 0.8, mouthY);
        ctx.strokeStyle = "#555";
        ctx.lineWidth = s * 0.4;
        ctx.stroke();
        break;
      case "frontend-designer":
        // Warm smile
        ctx.beginPath();
        ctx.arc(0, mouthY - s * 0.3, s * 1.3, 0.15, Math.PI - 0.15);
        ctx.strokeStyle = "#444";
        ctx.lineWidth = s * 0.5;
        ctx.stroke();
        break;
      case "reviewer":
        // Corner smirk
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, mouthY + s * 0.2);
        ctx.quadraticCurveTo(s * 0.3, mouthY - s * 0.3, s * 1, mouthY - s * 0.5);
        ctx.strokeStyle = "#555";
        ctx.lineWidth = s * 0.4;
        ctx.stroke();
        break;
      case "deployer":
        // Teeth-showing grin
        ctx.beginPath();
        ctx.arc(0, mouthY, s * 1.2, 0.1, Math.PI - 0.1);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = "#444";
        ctx.lineWidth = s * 0.4;
        ctx.stroke();
        break;
    }
  }
}

// ── Head Accessories ──────────────────────────────────────

function drawHeadAccessory(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  s: number,
  hr: number,
  state: CharacterState,
  time: number
) {
  switch (def.accessory) {
    case "glasses":
      ctx.strokeStyle = "#888";
      ctx.lineWidth = s * 0.4;
      // Left lens
      ctx.beginPath();
      ctx.roundRect(-hr * 0.55, -s * 0.6, hr * 0.45, s * 2.2, s * 0.5);
      ctx.stroke();
      // Right lens
      ctx.beginPath();
      ctx.roundRect(hr * 0.1, -s * 0.6, hr * 0.45, s * 2.2, s * 0.5);
      ctx.stroke();
      // Bridge
      ctx.beginPath();
      ctx.moveTo(-hr * 0.1, s * 0.4);
      ctx.lineTo(hr * 0.1, s * 0.4);
      ctx.stroke();
      // Temple arms
      ctx.beginPath();
      ctx.moveTo(-hr * 0.55, s * 0.3);
      ctx.lineTo(-hr * 1.05, s * 0.5);
      ctx.moveTo(hr * 0.55, s * 0.3);
      ctx.lineTo(hr * 1.05, s * 0.5);
      ctx.stroke();
      break;

    case "headphones":
      // Band
      ctx.strokeStyle = "#444";
      ctx.lineWidth = s * 1;
      ctx.beginPath();
      ctx.arc(0, -hr * 0.15, hr * 1.1, Math.PI + 0.35, -0.35);
      ctx.stroke();
      // Ear cups
      ctx.fillStyle = "#383838";
      ctx.beginPath();
      ctx.roundRect(-hr * 1.3, -s * 1.2, s * 2.2, s * 3.2, s * 0.8);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(hr * 1.3 - s * 2.2, -s * 1.2, s * 2.2, s * 3.2, s * 0.8);
      ctx.fill();
      // Cushion detail
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath();
      ctx.roundRect(-hr * 1.2, -s * 0.8, s * 1.6, s * 2.4, s * 0.5);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(hr * 1.2 - s * 1.6, -s * 0.8, s * 1.6, s * 2.4, s * 0.5);
      ctx.fill();
      break;

    case "beret-earring":
      // Beret is drawn in hair
      // Gold earring
      ctx.strokeStyle = "#d4a030";
      ctx.lineWidth = s * 0.4;
      ctx.beginPath();
      ctx.arc(hr * 1, hr * 0.3, s * 1, 0.3, Math.PI * 1.7);
      ctx.stroke();
      // Earring bead
      ctx.fillStyle = "#d4a030";
      drawCircle(ctx, hr * 1, hr * 0.3 + s * 1, s * 0.5);
      break;

    case "pocket-square":
      // Watch on wrist (visible at rest) — drawn on body, not head
      // Sharp shoes are on the legs — nothing on head
      break;

    case "headset":
      // Headset band
      ctx.strokeStyle = "#555";
      ctx.lineWidth = s * 0.7;
      ctx.beginPath();
      ctx.arc(0, -hr * 0.15, hr * 1.05, Math.PI + 0.45, -0.45);
      ctx.stroke();
      // Mic boom arm
      ctx.beginPath();
      ctx.moveTo(-hr * 1.1, s * 0.8);
      ctx.quadraticCurveTo(-hr * 1.2, s * 2.5, -hr * 0.6, s * 2.8);
      ctx.strokeStyle = "#666";
      ctx.lineWidth = s * 0.5;
      ctx.stroke();
      // Mic head
      ctx.fillStyle = "#555";
      drawCircle(ctx, -hr * 0.6, s * 2.8, s * 0.8);
      break;
  }
}

// ── Speech bubble ─────────────────────────────────────────

export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  time: number
) {
  const fadeIn = Math.min(1, (time % 4) / 0.3);
  if (fadeIn <= 0) return;

  ctx.save();
  ctx.globalAlpha = fadeIn * 0.95;

  ctx.font = "500 11px 'JetBrains Mono', monospace";
  const measured = ctx.measureText(text);
  const pw = measured.width + 16;
  const ph = 24;
  const bx = x - pw / 2;
  const by = y - ph - 8;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.beginPath();
  ctx.roundRect(bx + 1, by + 2, pw, ph, 6);
  ctx.fill();

  // Bubble
  ctx.beginPath();
  ctx.roundRect(bx, by, pw, ph, 6);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#e0dbd4";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo(x - 4, by + ph);
  ctx.lineTo(x, by + ph + 6);
  ctx.lineTo(x + 4, by + ph);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // Text
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, by + ph / 2);

  ctx.restore();
}

// ── Helpers ───────────────────────────────────────────────

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
