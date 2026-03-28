import type { DeveloperProfile, Repo } from "./fixtures";
import type { Theme } from "./themes";

const EXPORT_SCALE = 2;
const EXPORT_W = 380;
const EXPORT_H = 420;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let clipped = text;
  while (clipped.length > 0 && ctx.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }

  return clipped ? `${clipped}...` : text.slice(0, 1);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    lines.push(current || fitText(ctx, word, maxWidth));
    current = current ? word : "";

    if (lines.length === maxLines - 1) {
      const remainder = [current, ...words.slice(words.indexOf(word) + 1)]
        .filter(Boolean)
        .join(" ");
      if (remainder) {
        lines.push(fitText(ctx, remainder, maxWidth));
      }
      return lines;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function repoMeta(repo: Repo): string {
  const parts = [repo.language];
  if (repo.stars > 0) {
    parts.push(`★ ${formatNumber(repo.stars)}`);
  }
  if (repo.forks != null && repo.forks > 0) {
    parts.push(`⑂ ${formatNumber(repo.forks)}`);
  }
  return parts.join(" · ");
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  profile: DeveloperProfile,
  theme: Theme,
  avatarImage: CanvasImageSource | null
) {
  const avatarX = 20;
  const avatarY = 20;
  const avatarSize = 64;
  const radius = avatarSize / 2;
  const centerX = avatarX + radius;
  const centerY = avatarY + radius;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarImage) {
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.fillStyle = theme.cardBg;
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = profile.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2);
    ctx.fillText(initials, centerX, centerY);
  }

  ctx.restore();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function renderDevCardToCanvas(
  ctx: CanvasRenderingContext2D,
  profile: DeveloperProfile,
  theme: Theme,
  avatarImage: CanvasImageSource | null
) {
  drawRoundRect(ctx, 0, 0, EXPORT_W, EXPORT_H, 12);
  ctx.fillStyle = theme.cardBg;
  ctx.fill();
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  drawAvatar(ctx, profile, theme, avatarImage);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = theme.foreground;
  ctx.font = "bold 17px system-ui, sans-serif";
  ctx.fillText(fitText(ctx, profile.name, 255), 96, 36);

  ctx.fillStyle = theme.mutedText;
  ctx.font = "13px monospace";
  ctx.fillText(`@${profile.username}`, 96, 56);

  if (profile.bio) {
    ctx.fillStyle = theme.mutedText;
    ctx.font = "12px system-ui, sans-serif";
    const bioLines = wrapText(ctx, profile.bio, 255, 2);
    bioLines.forEach((line, index) => {
      ctx.fillText(line, 96, 74 + index * 14);
    });
  }

  ctx.strokeStyle = theme.cardBorder;
  ctx.beginPath();
  ctx.moveTo(20, 104);
  ctx.lineTo(EXPORT_W - 20, 104);
  ctx.stroke();

  const stats = [
    { label: "REPOS", value: formatNumber(profile.stats.repos) },
    { label: "FOLLOWERS", value: formatNumber(profile.stats.followers) },
    { label: "FOLLOWING", value: formatNumber(profile.stats.following) },
  ];
  const statWidth = (EXPORT_W - 40) / 3;

  stats.forEach((stat, index) => {
    const x = 20 + statWidth * index + statWidth / 2;
    ctx.fillStyle = theme.foreground;
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stat.value, x, 130);
    ctx.fillStyle = theme.statLabel;
    ctx.font = "500 9px system-ui, sans-serif";
    ctx.fillText(stat.label, x, 146);
  });

  ctx.textAlign = "left";
  let barX = 20;
  const barY = 162;
  const barWidth = EXPORT_W - 40;
  profile.languages.forEach((language) => {
    const segmentWidth = Math.max((language.percentage / 100) * barWidth - 1, 4);
    drawRoundRect(ctx, barX, barY, segmentWidth, 6, 3);
    ctx.fillStyle = language.color;
    ctx.fill();
    barX += (language.percentage / 100) * barWidth;
  });

  let legendX = 20;
  let legendY = 184;
  ctx.font = "11px system-ui, sans-serif";
  profile.languages.forEach((language) => {
    const label = `${language.name} ${language.percentage}%`;
    const labelWidth = ctx.measureText(label).width;
    if (legendX + labelWidth > EXPORT_W - 20) {
      legendX = 20;
      legendY += 18;
    }

    ctx.beginPath();
    ctx.arc(legendX + 4, legendY, 4, 0, Math.PI * 2);
    ctx.fillStyle = language.color;
    ctx.fill();

    ctx.fillStyle = theme.mutedText;
    ctx.fillText(label, legendX + 12, legendY + 4);
    legendX += labelWidth + 26;
  });

  let repoY = legendY + 28;
  ctx.fillStyle = theme.statLabel;
  ctx.font = "600 9px system-ui, sans-serif";
  ctx.fillText("TOP REPOSITORIES", 20, repoY);
  repoY += 14;

  profile.topRepos.forEach((repo) => {
    drawRoundRect(ctx, 20, repoY, EXPORT_W - 40, 34, 6);
    ctx.fillStyle = theme.repoBg;
    ctx.fill();
    ctx.strokeStyle = theme.cardBorder;
    ctx.stroke();

    const meta = repoMeta(repo);
    ctx.fillStyle = theme.mutedText;
    ctx.font = "11px system-ui, sans-serif";
    const metaWidth = ctx.measureText(meta).width;
    ctx.textAlign = "right";
    ctx.fillText(meta, EXPORT_W - 30, repoY + 14);

    ctx.textAlign = "left";
    ctx.fillStyle = theme.accent;
    ctx.font = "500 12px monospace";
    const repoNameWidth = EXPORT_W - 70 - metaWidth;
    ctx.fillText(fitText(ctx, repo.name, repoNameWidth), 30, repoY + 14);

    if (repo.description) {
      ctx.fillStyle = theme.mutedText;
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(fitText(ctx, repo.description, EXPORT_W - 60), 30, repoY + 27);
    }

    repoY += 40;
  });
}

async function loadAvatarImage(
  src: string,
  createImage: (() => HTMLImageElement) | undefined
): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = createImage ? createImage() : new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load avatar image"));
    image.src = src;
  });
}

interface ExportOptions {
  createImage?: () => HTMLImageElement;
  doc?: Document;
  urlApi?: typeof URL;
}

export async function exportCardAsPng(
  profile: DeveloperProfile,
  theme: Theme,
  options: ExportOptions = {}
) {
  const { createImage, doc = document, urlApi = URL } = options;
  const canvas = doc.createElement("canvas");
  canvas.width = EXPORT_W * EXPORT_SCALE;
  canvas.height = EXPORT_H * EXPORT_SCALE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  const avatarImage = await loadAvatarImage(profile.avatarUrl, createImage).catch(
    () => null
  );
  renderDevCardToCanvas(ctx, profile, theme, avatarImage);

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }

      const downloadUrl = urlApi.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = downloadUrl;
      link.download = `${profile.username}-devcard.png`;
      link.click();
      urlApi.revokeObjectURL(downloadUrl);
      resolve();
    }, "image/png");
  });
}
