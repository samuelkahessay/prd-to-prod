"use client";

import { useRef, useState } from "react";
import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";
import { useAnimationSound, TRACKS } from "@/hooks/use-animation-sound";
import styles from "./page.module.css";

interface Variant {
  name: string;
  desc: string;
  props: {
    amplitude?: "tight" | "medium" | "full";
    rotation?: boolean;
    squashPropagation?: boolean;
  };
}

const VARIANTS: Variant[] = [
  {
    name: "Medium",
    desc: "Default. Balanced physics.",
    props: {},
  },
  {
    name: "Tight",
    desc: "Subtle. Loading states, inline.",
    props: { amplitude: "tight" },
  },
  {
    name: "Full",
    desc: "Dramatic. Hero, demo video.",
    props: { amplitude: "full" },
  },
  {
    name: "Full + Rotation",
    desc: "Organic tilt on hops.",
    props: { amplitude: "full", rotation: true },
  },
  {
    name: "Full + Squash",
    desc: "Every letter deforms. Maximum Pixar.",
    props: { amplitude: "full", squashPropagation: true },
  },
  {
    name: "Full + All",
    desc: "Everything on. The showstopper.",
    props: { amplitude: "full", rotation: true, squashPropagation: true },
  },
];

export default function AnimationPage() {
  const [selected, setSelected] = useState(0);
  const [trackIdx, setTrackIdx] = useState(1); // default to melodic
  const [syncSeed, setSyncSeed] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const variant = VARIANTS[selected];
  const sound = useAnimationSound({
    amplitude: variant.props.amplitude ?? "medium",
    track: TRACKS[trackIdx].value,
    animationRootRef: stageRef,
  });

  const handleVariantSelect = (index: number) => {
    if (index === selected) return;
    setSelected(index);
  };

  const handleTrackSelect = (index: number) => {
    if (index === trackIdx) return;
    setTrackIdx(index);
    if (sound.enabled) setSyncSeed((value) => value + 1);
  };

  const handleSoundToggle = async () => {
    if (sound.enabled) {
      sound.disable();
      return;
    }

    const didEnable = await sound.enable();
    if (didEnable) setSyncSeed((value) => value + 1);
  };

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>prd-to-prod</span>
          <span className={styles.sidebarTitle}>Animation</span>
        </div>
        <nav className={styles.nav}>
          {VARIANTS.map((v, i) => (
            <button
              key={v.name}
              className={`${styles.navItem} ${i === selected ? styles.navItemActive : ""}`}
              onClick={() => handleVariantSelect(i)}
              type="button"
            >
              <span className={styles.navName}>{v.name}</span>
              <span className={styles.navDesc}>{v.desc}</span>
            </button>
          ))}
        </nav>

        <div className={styles.trackSection}>
          <span className={styles.trackLabel}>Sound</span>
          {TRACKS.map((tr, i) => (
            <button
              key={tr.value}
              className={`${styles.navItem} ${i === trackIdx ? styles.navItemActive : ""}`}
              onClick={() => handleTrackSelect(i)}
              type="button"
            >
              <span className={styles.navName}>{tr.label}</span>
              <span className={styles.navDesc}>{tr.desc}</span>
            </button>
          ))}
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.stage} ref={stageRef}>
          <PrdToProdAnimation size={80} {...variant.props} key={`${selected}-${syncSeed}`} />
        </div>
        <div className={styles.info}>
          <span className={styles.infoName}>{variant.name}</span>
          <span className={styles.infoDesc}>{variant.desc}</span>
        </div>
        <button
          className={styles.soundToggle}
          onClick={() => {
            void handleSoundToggle();
          }}
          type="button"
          aria-label={sound.enabled ? "Mute sound" : "Enable sound"}
        >
          {sound.enabled ? "sound on" : "sound off"}
        </button>
      </main>
    </div>
  );
}
