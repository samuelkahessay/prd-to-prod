export interface Theme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
  mutedText: string;
  statLabel: string;
  repoBg: string;
}

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    background: "oklch(15% 0.04 255)",
    foreground: "oklch(92% 0.01 255)",
    accent: "oklch(65% 0.18 255)",
    cardBg: "oklch(20% 0.04 255)",
    cardBorder: "oklch(30% 0.05 255)",
    mutedText: "oklch(62% 0.03 255)",
    statLabel: "oklch(50% 0.04 255)",
    repoBg: "oklch(24% 0.04 255)",
  },
  {
    id: "aurora",
    name: "Aurora",
    background: "oklch(14% 0.05 290)",
    foreground: "oklch(93% 0.01 150)",
    accent: "oklch(68% 0.2 155)",
    cardBg: "oklch(18% 0.06 290)",
    cardBorder: "oklch(30% 0.08 280)",
    mutedText: "oklch(60% 0.05 200)",
    statLabel: "oklch(48% 0.06 270)",
    repoBg: "oklch(22% 0.06 285)",
  },
  {
    id: "sunset",
    name: "Sunset",
    background: "oklch(22% 0.06 35)",
    foreground: "oklch(96% 0.01 75)",
    accent: "oklch(72% 0.18 55)",
    cardBg: "oklch(28% 0.07 35)",
    cardBorder: "oklch(40% 0.09 35)",
    mutedText: "oklch(65% 0.05 40)",
    statLabel: "oklch(52% 0.06 40)",
    repoBg: "oklch(32% 0.07 35)",
  },
  {
    id: "neon",
    name: "Neon",
    background: "oklch(8% 0.01 120)",
    foreground: "oklch(88% 0.15 145)",
    accent: "oklch(78% 0.24 145)",
    cardBg: "oklch(12% 0.02 130)",
    cardBorder: "oklch(28% 0.1 145)",
    mutedText: "oklch(55% 0.1 145)",
    statLabel: "oklch(42% 0.08 140)",
    repoBg: "oklch(15% 0.03 130)",
  },
  {
    id: "arctic",
    name: "Arctic",
    background: "oklch(95% 0.02 215)",
    foreground: "oklch(18% 0.04 220)",
    accent: "oklch(55% 0.18 220)",
    cardBg: "oklch(98% 0.01 215)",
    cardBorder: "oklch(84% 0.04 215)",
    mutedText: "oklch(48% 0.04 220)",
    statLabel: "oklch(58% 0.04 215)",
    repoBg: "oklch(93% 0.025 215)",
  },
  {
    id: "mono",
    name: "Mono",
    background: "oklch(12% 0 0)",
    foreground: "oklch(94% 0 0)",
    accent: "oklch(80% 0 0)",
    cardBg: "oklch(17% 0 0)",
    cardBorder: "oklch(30% 0 0)",
    mutedText: "oklch(58% 0 0)",
    statLabel: "oklch(45% 0 0)",
    repoBg: "oklch(21% 0 0)",
  },
];

export const DEFAULT_THEME = THEMES[0];
