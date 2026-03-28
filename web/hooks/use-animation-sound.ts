"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as Tone from "tone";

type Track = "percussive" | "melodic";

interface AnimationSoundOptions {
  /** Cycle duration in seconds — must match CSS --duration */
  duration?: number;
  amplitude?: "tight" | "medium" | "full";
  /** Sound track to use */
  track?: Track;
  /** Animation root that emits bubbled animation events */
  animationRootRef?: RefObject<HTMLElement | null>;
}

// ─── Track 1: Percussive (original) ──────────────────────────────

interface PercussiveNodes {
  kind: "percussive";
  impact: Tone.MembraneSynth;
  bounce: Tone.MembraneSynth;
  tapR: Tone.MetalSynth;
  tapP: Tone.MetalSynth;
  whoosh: Tone.NoiseSynth;
  pad: Tone.Synth;
  exit: Tone.NoiseSynth;
  reverb: Tone.Reverb;
  filter: Tone.AutoFilter;
}

function buildPercussive(vol: number): PercussiveNodes {
  const reverb = new Tone.Reverb({ decay: 1.4, wet: 0.3 }).toDestination();

  // Primary impact — warm membrane (the "o" squashes)
  const impact = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.4 },
  }).connect(reverb);
  impact.volume.value = vol;

  // Secondary bounce — lighter, higher pitched (the "o" springs up)
  const bounce = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 3,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 },
  }).connect(reverb);
  bounce.volume.value = vol - 6;

  // Ripple taps
  const tapR = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 3000,
    octaves: 0.5,
  }).connect(reverb);
  tapR.frequency.value = 300;
  tapR.volume.value = vol - 8;

  const tapP = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.06, release: 0.04 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 4000,
    octaves: 0.5,
  }).connect(reverb);
  tapP.frequency.value = 400;
  tapP.volume.value = vol - 12;

  // Whoosh — falling "o"
  const whoosh = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.02, decay: 0.18, sustain: 0, release: 0.08 },
  });
  const filter = new Tone.AutoFilter({
    frequency: 10,
    baseFrequency: 600,
    octaves: 5,
  }).connect(reverb);
  filter.start();
  whoosh.connect(filter);
  whoosh.volume.value = vol - 14;

  // Settle pad — gentle sine that fills the hold phase
  const pad = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.3, release: 1.0 },
  }).connect(reverb);
  pad.volume.value = vol - 20;

  // Exit — reverse-ish whoosh (white noise, fast attack, longer release)
  const exit = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.15 },
  }).connect(reverb);
  exit.volume.value = vol - 18;

  return { kind: "percussive", impact, bounce, tapR, tapP, whoosh, pad, exit, reverb, filter };
}

// Timeline (3.6s, Full+All):
//   29% (1.04s) — whoosh starts (o mid-fall, accelerating)
//   35% (1.26s) — IMPACT (o squash, maximum deformation)
//   36% (1.30s) — r hop peak (8px up, tilted)
//   38% (1.37s) — p hop peak (6px up, tilted opposite)
//   42% (1.51s) — BOUNCE (o springs up 6px, stretch)
//   48% (1.73s) — micro-settle (o oscillation damps)
//   54% (1.94s) — pad swell (everything at rest, "prod" complete)
//   90% (3.24s) — exit whoosh (o fades, d slides back)
function playPercussive(nodes: PercussiveNodes, t: number, dur: number) {
  // Fall — whoosh accelerates into impact
  nodes.whoosh.triggerAttackRelease(0.2, t + dur * 0.29);

  // Impact — the downbeat, maximum squash
  nodes.impact.triggerAttackRelease("C2", 0.2, t + dur * 0.35);

  // Ripple — staggered taps at hop peaks
  nodes.tapR.triggerAttackRelease("16n", t + dur * 0.36);
  nodes.tapP.triggerAttackRelease("16n", t + dur * 0.38);

  // Bounce — secondary impact as o springs up (lighter, higher)
  nodes.bounce.triggerAttackRelease("G2", 0.1, t + dur * 0.42);

  // Settle — pad swells in during the hold phase
  nodes.pad.triggerAttackRelease("G4", 0.9, t + dur * 0.54, 0.12);

  // Exit — short noise burst as o disappears
  nodes.exit.triggerAttackRelease(0.12, t + dur * 0.90);
}

function disposePercussive(nodes: PercussiveNodes) {
  nodes.impact.dispose();
  nodes.bounce.dispose();
  nodes.tapR.dispose();
  nodes.tapP.dispose();
  nodes.whoosh.dispose();
  nodes.filter.dispose();
  nodes.pad.dispose();
  nodes.exit.dispose();
  nodes.reverb.dispose();
}

// ─── Track 2: Melodic ────────────────────────────────────────────
//
// Musical phrase in E minor pentatonic. The animation arc becomes:
//   fall → descending grace notes (E5 → B4)
//   impact → bass root (E2) + chord stab (Em7)
//   ripple → ascending dyads that "ring out" like a marimba
//   settle → resolving pad chord (Em → Em9)
//   exit → high harmonic fading out
//
// Everything through a shared delay + reverb for cohesion.

interface MelodicNodes {
  kind: "melodic";
  bass: Tone.Synth;
  chordA: Tone.PolySynth;
  chordB: Tone.PolySynth;
  bell: Tone.Synth;
  bounce: Tone.Synth;
  grace: Tone.Synth;
  harmonic: Tone.Synth;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
}

function buildMelodic(vol: number): MelodicNodes {
  const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.35 }).toDestination();
  const delay = new Tone.FeedbackDelay({
    delayTime: "16n",
    feedback: 0.2,
    wet: 0.25,
  }).connect(reverb);

  // Bass — deep triangle with body
  const bass = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.1, release: 0.6 },
  }).connect(reverb);
  bass.volume.value = vol - 2;

  // Impact chord — short stab through delay for shimmer
  const chordA = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.05, release: 0.4 },
  }).connect(delay);
  chordA.volume.value = vol - 8;

  // Resolve pad — slow attack, long sustain, fills the hold phase
  const chordB = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.5, decay: 0.6, sustain: 0.4, release: 1.4 },
  }).connect(reverb);
  chordB.volume.value = vol - 16;

  // Bell — clean sine for ripple notes
  const bell = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.3 },
  }).connect(delay);
  bell.volume.value = vol - 6;

  // Bounce note — the "o" springs up, a melodic answer to the impact
  const bounce = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.25, sustain: 0, release: 0.2 },
  }).connect(delay);
  bounce.volume.value = vol - 8;

  // Grace notes — quick descending run during the fall
  const grace = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.06 },
  }).connect(delay);
  grace.volume.value = vol - 12;

  // High harmonic for exit — glass-like, barely there
  const harmonic = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.15, decay: 0.4, sustain: 0.05, release: 1.0 },
  }).connect(reverb);
  harmonic.volume.value = vol - 20;

  return { kind: "melodic", bass, chordA, chordB, bell, bounce, grace, harmonic, delay, reverb };
}

// Timeline (3.6s, Full+All):
//   29% (1.04s) — grace note run begins (o accelerating down)
//   35% (1.26s) — IMPACT: bass E2 + Em7 chord stab (o max squash)
//   36% (1.30s) — bell B4 (r hop peak)
//   38% (1.37s) — bell E5 (p hop peak)
//   42% (1.51s) — bounce note G4 (o springs up — melodic answer)
//   48% (1.73s) — pad chord enters (o micro-settle, everything calming)
//   90% (3.24s) — high harmonic E6 (o exits, glass shimmer)
function playMelodic(nodes: MelodicNodes, t: number, dur: number) {
  // ── Fall (29–33%): descending grace notes ──
  // E pentatonic descent — accelerating into impact
  // Starts when o is ~60% through its fall, visible at 75% opacity
  nodes.grace.triggerAttackRelease("E5", 0.07, t + dur * 0.29, 0.35);
  nodes.grace.triggerAttackRelease("D5", 0.07, t + dur * 0.31, 0.25);
  nodes.grace.triggerAttackRelease("B4", 0.07, t + dur * 0.33, 0.15);

  // ── Impact (35%): bass root + chord stab ──
  // The downbeat — o hits ground, maximum squash deformation
  nodes.bass.triggerAttackRelease("E2", 0.5, t + dur * 0.35);
  nodes.chordA.triggerAttackRelease(
    ["E3", "G3", "B3", "D4"],  // Em7
    0.2,
    t + dur * 0.35,
    0.55
  );

  // ── Ripple (36%, 38%): bell notes at hop peaks ──
  // "r" hops at 36% — 5th above root (B4), bright and open
  nodes.bell.triggerAttackRelease("B4", 0.3, t + dur * 0.36, 0.45);
  // "p" hops at 38% — octave (E5), rings through delay
  nodes.bell.triggerAttackRelease("E5", 0.25, t + dur * 0.38, 0.35);

  // ── Bounce (42%): melodic answer ──
  // o springs up 6px with stretch — a lighter, higher note
  // G4 = the minor 3rd above E, resolves the phrase upward
  nodes.bounce.triggerAttackRelease("G4", 0.2, t + dur * 0.42, 0.3);

  // ── Settle (48–80%): resolving pad chord ──
  // Enters at micro-settle (48%), sustains through the hold phase
  // Em9 — the added F#4 introduces warmth as "prod" rests
  nodes.chordB.triggerAttackRelease(
    ["E3", "G3", "B3", "F#4"],  // Em9
    1.1,
    t + dur * 0.48,
    0.25
  );

  // ── Exit (90%): high harmonic ──
  // Glass-like E6 as o fades out and d slides back
  nodes.harmonic.triggerAttackRelease("E6", 0.5, t + dur * 0.90, 0.12);
}

function disposeMelodic(nodes: MelodicNodes) {
  nodes.bass.dispose();
  nodes.chordA.dispose();
  nodes.chordB.dispose();
  nodes.bell.dispose();
  nodes.bounce.dispose();
  nodes.grace.dispose();
  nodes.harmonic.dispose();
  nodes.delay.dispose();
  nodes.reverb.dispose();
}

// ─── Unified types ───────────────────────────────────────────────

type SynthNodes = PercussiveNodes | MelodicNodes;

function buildNodes(track: Track, vol: number): SynthNodes {
  return track === "melodic" ? buildMelodic(vol) : buildPercussive(vol);
}

function playCycle(nodes: SynthNodes, t: number, dur: number) {
  if (nodes.kind === "melodic") playMelodic(nodes, t, dur);
  else playPercussive(nodes, t, dur);
}

function disposeNodes(nodes: SynthNodes) {
  if (nodes.kind === "melodic") disposeMelodic(nodes);
  else disposePercussive(nodes);
}

// ─── Hook ────────────────────────────────────────────────────────

export function useAnimationSound(options: AnimationSoundOptions = {}) {
  const {
    duration = 3.6,
    amplitude = "medium",
    track = "melodic",
    animationRootRef,
  } = options;

  const [enabled, setEnabled] = useState(false);
  const nodesRef = useRef<SynthNodes | null>(null);

  const vol = amplitude === "tight" ? -12 : amplitude === "full" ? -4 : -8;

  const teardown = useCallback(() => {
    if (!nodesRef.current) return;
    disposeNodes(nodesRef.current);
    nodesRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!enabled) return;
    const animationRoot = animationRootRef?.current;
    if (!animationRoot) return;

    teardown();
    const nodes = buildNodes(track, vol);
    nodesRef.current = nodes;

    const handleCycle = (event: Event) => {
      const animationEvent = event as AnimationEvent;
      if (animationEvent.animationName !== "dropO") return;
      if (!nodesRef.current) return;
      playCycle(nodesRef.current, Tone.now(), duration);
    };

    animationRoot.addEventListener("animationstart", handleCycle);
    animationRoot.addEventListener("animationiteration", handleCycle);

    return () => {
      animationRoot.removeEventListener("animationstart", handleCycle);
      animationRoot.removeEventListener("animationiteration", handleCycle);
      teardown();
    };
  }, [animationRootRef, duration, enabled, teardown, track, vol]);

  useEffect(() => teardown, [teardown]);

  const enable = useCallback(async () => {
    if (enabled) return false;
    await Tone.start();
    setEnabled(true);
    return true;
  }, [enabled]);

  const disable = useCallback(() => {
    setEnabled(false);
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      return false;
    }

    await Tone.start();
    setEnabled(true);
    return true;
  }, [enabled]);

  return { enabled, enable, disable, toggle };
}

export const TRACKS: { value: Track; label: string; desc: string }[] = [
  { value: "percussive", label: "Percussive", desc: "Impact hits + noise. Sound effects." },
  { value: "melodic", label: "Melodic", desc: "Em7 phrase. Musical." },
];
