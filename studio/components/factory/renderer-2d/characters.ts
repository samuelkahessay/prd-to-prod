import type { AgentId, CharacterState } from "../factory-types";

// Diverse skin tone palette
const SKIN_TONES: Record<string, { base: string; shadow: string }> = {
  light: { base: "#f0d5b8", shadow: "#dbb896" },
  medium: { base: "#c68642", shadow: "#a86e35" },
  brown: { base: "#8d5524", shadow: "#6e4220" },
  dark: { base: "#5c3a1e", shadow: "#4a2e17" },
  olive: { base: "#d4a574", shadow: "#b8895e" },
};

export interface CharacterVisual {
  bodyColor: string;
  bodyAccent: string;
  hairColor: string;
  skinTone: keyof typeof SKIN_TONES;
  accessory: "glasses" | "headphones" | "beret" | "clipboard" | "headset";
  hairStyle: "short" | "long" | "curly" | "buzz" | "styled";
}

export const CHARACTER_VISUALS: Record<AgentId, CharacterVisual> = {
  planner: {
    bodyColor: "#4a6fd8",  // blue vest
    bodyAccent: "#f5f3f0", // white shirt
    hairColor: "#1a1a1a",
    skinTone: "dark",
    accessory: "glasses",
    hairStyle: "short",
  },
  developer: {
    bodyColor: "#2d2d2d",  // dark hoodie
    bodyAccent: "#444",
    hairColor: "#1a1a1a",
    skinTone: "medium",
    accessory: "headphones",
    hairStyle: "buzz",
  },
  "frontend-designer": {
    bodyColor: "#9b7ed8",  // purple top
    bodyAccent: "#c4b0f0",
    hairColor: "#1a1a1a",
    skinTone: "olive",
    accessory: "beret",
    hairStyle: "long",
  },
  reviewer: {
    bodyColor: "#3d3d3d",  // dark blazer
    bodyAccent: "#f5f3f0", // white shirt
    hairColor: "#2d1f1a",
    skinTone: "brown",
    accessory: "clipboard",
    hairStyle: "curly",
  },
  deployer: {
    bodyColor: "#3d9a6a",  // green jacket
    bodyAccent: "#2d7a54",
    hairColor: "#3a2a1e",
    skinTone: "light",
    accessory: "headset",
    hairStyle: "styled",
  },
};

function getSkinColors(v: CharacterVisual) {
  return SKIN_TONES[v.skinTone];
}

interface DrawOpts {
  x: number;
  y: number;
  scale: number;
  state: CharacterState;
  time: number;
  agentId: AgentId;
  facing?: "left" | "right";
}

export function drawCharacter(ctx: CanvasRenderingContext2D, opts: DrawOpts) {
  const { x, y, scale, state, time, agentId, facing = "right" } = opts;
  const v = CHARACTER_VISUALS[agentId];
  const skin = getSkinColors(v);
  const s = scale;

  ctx.save();
  ctx.translate(x, y);
  if (facing === "left") {
    ctx.scale(-1, 1);
  }

  // Animation offsets
  const breathe = Math.sin(time * 2) * s * 0.5;
  const bounce = state === "celebrating" ? Math.abs(Math.sin(time * 6)) * s * 8 : 0;
  const wobble = state === "working" ? Math.sin(time * 8) * s * 1 : 0;
  const headTilt = state === "reviewing" ? Math.sin(time * 1.5) * 0.05 : 0;
  const blocked = state === "blocked";

  const bodyY = -bounce;

  // Shadow on ground
  ctx.beginPath();
  ctx.ellipse(0, s * 2, s * 6 + (bounce > 0 ? -2 : 0), s * 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fill();

  // --- Legs ---
  const legSpread = state === "celebrating" ? Math.sin(time * 6) * s * 3 : 0;
  const walkCycle = state === "working" ? 0 : Math.sin(time * 3) * s * 1;

  // Left leg
  ctx.beginPath();
  ctx.moveTo(-s * 2.5 - legSpread, bodyY);
  ctx.lineTo(-s * 3 - legSpread + walkCycle, s * 2);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = s * 2.2;
  ctx.lineCap = "round";
  ctx.stroke();

  // Right leg
  ctx.beginPath();
  ctx.moveTo(s * 2.5 + legSpread, bodyY);
  ctx.lineTo(s * 3 + legSpread - walkCycle, s * 2);
  ctx.stroke();

  // Shoes
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.ellipse(-s * 3 - legSpread + walkCycle, s * 2.5, s * 2.5, s * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 3 + legSpread - walkCycle, s * 2.5, s * 2.5, s * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Body (torso) ---
  ctx.beginPath();
  ctx.moveTo(-s * 5, bodyY - s * 4 + breathe);
  ctx.lineTo(-s * 3, bodyY + s * 1);
  ctx.lineTo(s * 3, bodyY + s * 1);
  ctx.lineTo(s * 5, bodyY - s * 4 + breathe);
  ctx.closePath();
  ctx.fillStyle = v.bodyColor;
  ctx.fill();

  // Shirt/accent collar
  ctx.beginPath();
  ctx.moveTo(-s * 2, bodyY - s * 6 + breathe);
  ctx.lineTo(-s * 1, bodyY - s * 3 + breathe);
  ctx.lineTo(s * 1, bodyY - s * 3 + breathe);
  ctx.lineTo(s * 2, bodyY - s * 6 + breathe);
  ctx.closePath();
  ctx.fillStyle = v.bodyAccent;
  ctx.fill();

  // --- Arms ---
  const armBase = bodyY - s * 4 + breathe;

  if (state === "working") {
    // Arms forward (typing / drawing)
    const typingL = Math.sin(time * 12) * s * 1.5;
    const typingR = Math.sin(time * 12 + 1) * s * 1.5;

    ctx.beginPath();
    ctx.moveTo(-s * 5, armBase);
    ctx.quadraticCurveTo(-s * 6, armBase + s * 4, -s * 3 + typingL, armBase + s * 5);
    ctx.strokeStyle = v.bodyColor;
    ctx.lineWidth = s * 2;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s * 5, armBase);
    ctx.quadraticCurveTo(s * 6, armBase + s * 4, s * 3 + typingR, armBase + s * 5);
    ctx.stroke();

    // Hands
    ctx.fillStyle = skin.base;
    ctx.beginPath();
    ctx.arc(-s * 3 + typingL, armBase + s * 5, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 3 + typingR, armBase + s * 5, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (state === "celebrating") {
    // Arms up!
    const wave = Math.sin(time * 8) * s * 2;
    ctx.beginPath();
    ctx.moveTo(-s * 5, armBase);
    ctx.quadraticCurveTo(-s * 8, armBase - s * 4, -s * 6 + wave, armBase - s * 10);
    ctx.strokeStyle = v.bodyColor;
    ctx.lineWidth = s * 2;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s * 5, armBase);
    ctx.quadraticCurveTo(s * 8, armBase - s * 4, s * 6 - wave, armBase - s * 10);
    ctx.stroke();

    // Hands
    ctx.fillStyle = skin.base;
    ctx.beginPath();
    ctx.arc(-s * 6 + wave, armBase - s * 10, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 6 - wave, armBase - s * 10, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (state === "blocked") {
    // Arms crossed
    ctx.beginPath();
    ctx.moveTo(-s * 5, armBase);
    ctx.quadraticCurveTo(-s * 3, armBase + s * 3, s * 2, armBase + s * 2);
    ctx.strokeStyle = v.bodyColor;
    ctx.lineWidth = s * 2;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s * 5, armBase);
    ctx.quadraticCurveTo(s * 3, armBase + s * 3, -s * 2, armBase + s * 2);
    ctx.stroke();
  } else {
    // Idle - arms at sides
    const sway = Math.sin(time * 1.5) * s * 0.8;
    ctx.beginPath();
    ctx.moveTo(-s * 5, armBase);
    ctx.quadraticCurveTo(-s * 6, armBase + s * 4, -s * 4 + sway, armBase + s * 6);
    ctx.strokeStyle = v.bodyColor;
    ctx.lineWidth = s * 2;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s * 5, armBase);
    ctx.quadraticCurveTo(s * 6, armBase + s * 4, s * 4 - sway, armBase + s * 6);
    ctx.stroke();

    // Hands
    ctx.fillStyle = skin.base;
    ctx.beginPath();
    ctx.arc(-s * 4 + sway, armBase + s * 6, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 4 - sway, armBase + s * 6, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Head ---
  const headY = bodyY - s * 9 + breathe;

  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(headTilt);

  // Neck
  ctx.fillStyle = skin.shadow;
  ctx.fillRect(-s * 1.5, s * 1, s * 3, s * 2);

  // Head shape
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 5, s * 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.base;
  ctx.fill();

  // Hair
  drawHair(ctx, v, s);

  // Eyes
  const blinkCycle = Math.floor(time * 0.5) % 4 === 0 && Math.sin(time * 20) > 0.8;
  const eyeY = s * 0.5;

  if (blinkCycle) {
    // Blink
    ctx.beginPath();
    ctx.moveTo(-s * 2, eyeY);
    ctx.lineTo(-s * 1, eyeY);
    ctx.moveTo(s * 1, eyeY);
    ctx.lineTo(s * 2, eyeY);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = s * 0.8;
    ctx.stroke();
  } else {
    // Open eyes
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(-s * 1.8, eyeY, s * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 1.8, eyeY, s * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Eye whites (tiny specular)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-s * 1.5, eyeY - s * 0.3, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 2.1, eyeY - s * 0.3, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth
  if (state === "celebrating") {
    ctx.beginPath();
    ctx.arc(0, s * 2.5, s * 1.5, 0, Math.PI);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = s * 0.6;
    ctx.stroke();
  } else if (blocked) {
    // Frown
    ctx.beginPath();
    ctx.arc(0, s * 3.5, s * 1.2, Math.PI, 0);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = s * 0.6;
    ctx.stroke();
  } else {
    // Neutral / slight smile
    ctx.beginPath();
    ctx.arc(0, s * 2.2, s * 1, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = s * 0.5;
    ctx.stroke();
  }

  // Accessory
  drawAccessory(ctx, v, s, state, time);

  ctx.restore(); // head transform

  ctx.restore(); // main transform (including facing flip)
}

function drawHair(ctx: CanvasRenderingContext2D, v: CharacterVisual, s: number) {
  ctx.fillStyle = v.hairColor;

  switch (v.hairStyle) {
    case "short":
      ctx.beginPath();
      ctx.ellipse(0, -s * 2, s * 5.2, s * 4, 0, Math.PI, 0);
      ctx.fill();
      break;
    case "buzz":
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.5, s * 5, s * 4.5, 0, Math.PI + 0.3, -0.3);
      ctx.fill();
      break;
    case "curly":
      for (let i = 0; i < 7; i++) {
        const angle = Math.PI + (i / 6) * Math.PI;
        const hx = Math.cos(angle) * s * 5.5;
        const hy = Math.sin(angle) * s * 5.5 - s * 1;
        ctx.beginPath();
        ctx.arc(hx, hy, s * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "long":
      ctx.beginPath();
      ctx.ellipse(0, -s * 2, s * 5.5, s * 4.5, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-s * 5.5, -s * 2, s * 2, s * 8);
      ctx.fillRect(s * 3.5, -s * 2, s * 2, s * 8);
      break;
    case "styled":
      ctx.beginPath();
      ctx.ellipse(0, -s * 2.5, s * 5.3, s * 4, 0, Math.PI, 0);
      ctx.fill();
      // Side part
      ctx.beginPath();
      ctx.moveTo(-s * 3, -s * 5.5);
      ctx.quadraticCurveTo(s * 1, -s * 7, s * 5, -s * 4);
      ctx.lineWidth = s * 1.5;
      ctx.strokeStyle = v.hairColor;
      ctx.stroke();
      break;
  }
}

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  v: CharacterVisual,
  s: number,
  state: CharacterState,
  time: number
) {
  switch (v.accessory) {
    case "glasses":
      ctx.strokeStyle = "#666";
      ctx.lineWidth = s * 0.5;
      // Left lens
      ctx.beginPath();
      ctx.roundRect(-s * 3.2, -s * 0.8, s * 2.8, s * 2.2, s * 0.5);
      ctx.stroke();
      // Right lens
      ctx.beginPath();
      ctx.roundRect(s * 0.4, -s * 0.8, s * 2.8, s * 2.2, s * 0.5);
      ctx.stroke();
      // Bridge
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, s * 0.3);
      ctx.lineTo(s * 0.4, s * 0.3);
      ctx.stroke();
      break;

    case "headphones":
      ctx.strokeStyle = "#555";
      ctx.lineWidth = s * 1.2;
      ctx.beginPath();
      ctx.arc(0, -s * 1, s * 5.5, Math.PI + 0.4, -0.4);
      ctx.stroke();
      // Ear cups
      ctx.fillStyle = "#444";
      ctx.beginPath();
      ctx.roundRect(-s * 6.5, -s * 1.5, s * 2.5, s * 3.5, s * 1);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(s * 4, -s * 1.5, s * 2.5, s * 3.5, s * 1);
      ctx.fill();
      break;

    case "beret":
      ctx.fillStyle = v.bodyColor;
      ctx.beginPath();
      ctx.ellipse(-s * 1, -s * 5.5, s * 5, s * 2.5, -0.15, 0, Math.PI * 2);
      ctx.fill();
      // Nub on top
      ctx.beginPath();
      ctx.arc(-s * 1, -s * 7.5, s * 1, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "clipboard":
      // Only visible when reviewing
      if (state === "reviewing" || state === "idle") {
        // Draw nothing on head, clipboard is in the body area
      }
      break;

    case "headset":
      ctx.strokeStyle = "#555";
      ctx.lineWidth = s * 0.8;
      ctx.beginPath();
      ctx.arc(0, -s * 1, s * 5.2, Math.PI + 0.5, -0.5);
      ctx.stroke();
      // Mic arm
      ctx.beginPath();
      ctx.moveTo(-s * 5.5, s * 1);
      ctx.quadraticCurveTo(-s * 6, s * 3, -s * 3.5, s * 3.5);
      ctx.strokeStyle = "#666";
      ctx.lineWidth = s * 0.6;
      ctx.stroke();
      // Mic
      ctx.beginPath();
      ctx.arc(-s * 3.5, s * 3.5, s * 1, 0, Math.PI * 2);
      ctx.fillStyle = "#555";
      ctx.fill();
      break;
  }
}

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

  // Bubble
  ctx.beginPath();
  ctx.roundRect(bx, by, pw, ph, 6);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#ddd";
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
