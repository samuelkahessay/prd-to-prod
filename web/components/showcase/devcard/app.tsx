"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { FIXTURE_PROFILES, findProfile, type DeveloperProfile } from "./fixtures";
import { THEMES, DEFAULT_THEME, type Theme } from "./themes";
import { exportCardAsPng } from "./export";
import {
  buildDevCardShareUrl,
  resolveDevCardShareState,
} from "./share";
import styles from "./app.module.css";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ── DevCard ────────────────────────────────────────────────────────────────

function DevCard({
  profile,
  theme,
  size = "full",
}: {
  profile: DeveloperProfile;
  theme: Theme;
  size?: "full" | "mini";
}) {
  const cardStyle = {
    "--card-bg": theme.cardBg,
    "--card-border": theme.cardBorder,
    "--card-fg": theme.foreground,
    "--card-accent": theme.accent,
    "--card-muted": theme.mutedText,
    "--card-stat-label": theme.statLabel,
    "--card-repo-bg": theme.repoBg,
  } as React.CSSProperties;

  if (size === "mini") {
    return (
      <div className={styles.miniCard} style={cardStyle}>
        <img
          className={styles.miniAvatar}
          src={profile.avatarUrl}
          alt={profile.name}
          width={36}
          height={36}
        />
        <div className={styles.miniInfo}>
          <span className={styles.miniName}>{profile.name}</span>
          <span className={styles.miniUsername}>@{profile.username}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.devCard} style={cardStyle}>
      {/* Profile section */}
      <div className={styles.cardProfile}>
        <img
          className={styles.avatar}
          src={profile.avatarUrl}
          alt={profile.name}
          width={64}
          height={64}
        />
        <div className={styles.profileInfo}>
          <h2 className={styles.profileName}>{profile.name}</h2>
          <span className={styles.profileUsername}>@{profile.username}</span>
          {profile.bio && <p className={styles.profileBio}>{profile.bio}</p>}
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatNumber(profile.stats.repos)}</span>
          <span className={styles.statLabel}>Repos</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatNumber(profile.stats.followers)}</span>
          <span className={styles.statLabel}>Followers</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{formatNumber(profile.stats.following)}</span>
          <span className={styles.statLabel}>Following</span>
        </div>
      </div>

      {/* Language breakdown */}
      <div className={styles.languageSection}>
        <div className={styles.langBar}>
          {profile.languages.map((lang) => (
            <div
              key={lang.name}
              className={styles.langSegment}
              style={{ width: `${lang.percentage}%`, background: lang.color }}
              title={`${lang.name}: ${lang.percentage}%`}
            />
          ))}
        </div>
        <div className={styles.langLegend}>
          {profile.languages.map((lang) => (
            <span key={lang.name} className={styles.langLegendItem}>
              <span
                className={styles.langDot}
                style={{ background: lang.color }}
              />
              {lang.name}
              <span className={styles.langPct}>{lang.percentage}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Top repos */}
      <div className={styles.reposSection}>
        <h3 className={styles.reposTitle}>Top repositories</h3>
        <div className={styles.repoList}>
          {profile.topRepos.map((repo) => (
            <div key={repo.name} className={styles.repoItem}>
              <div className={styles.repoInfo}>
                <span className={styles.repoName}>{repo.name}</span>
                {repo.description && (
                  <span className={styles.repoDesc}>{repo.description}</span>
                )}
              </div>
              <div className={styles.repoMeta}>
                <span className={styles.repoLang}>{repo.language}</span>
                {repo.stars > 0 && (
                  <span className={styles.repoStars}>
                    ★ {formatNumber(repo.stars)}
                  </span>
                )}
                {repo.forks != null && repo.forks > 0 && (
                  <span className={styles.repoForks}>
                    ⑂ {formatNumber(repo.forks)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [input, setInput] = useState("");
  const [activeProfile, setActiveProfile] = useState<DeveloperProfile | null>(
    FIXTURE_PROFILES[0]
  );
  const [notFound, setNotFound] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(DEFAULT_THEME);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const { profile, requestedUser, theme } = resolveDevCardShareState(
      window.location.search
    );

    setSelectedTheme(theme);

    if (profile) {
      setActiveProfile(profile);
      setNotFound(false);
      setInput(requestedUser ?? "");
      return;
    }

    if (requestedUser) {
      setActiveProfile(null);
      setNotFound(true);
      setInput(requestedUser);
    }
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!activeProfile) return;

    const shareUrl = buildDevCardShareUrl(
      window.location.href,
      activeProfile,
      selectedTheme
    );

    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [activeProfile, selectedTheme]);

  const handleExportPng = useCallback(() => {
    if (activeProfile) {
      void exportCardAsPng(activeProfile, selectedTheme);
    }
  }, [activeProfile, selectedTheme]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const match = findProfile(trimmed);
    if (match) {
      setActiveProfile(match);
      setNotFound(false);
    } else {
      setActiveProfile(null);
      setNotFound(true);
    }
  }

  function handleGalleryClick(profile: DeveloperProfile) {
    setActiveProfile(profile);
    setNotFound(false);
    setInput(profile.username);
  }

  return (
    <div className={styles.shell}>
      {/* Left panel: input + card + theme selector */}
      <div className={styles.mainPanel}>
        <form className={styles.searchForm} onSubmit={handleSubmit}>
          <input
            className={styles.usernameInput}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a GitHub username…"
            aria-label="GitHub username"
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className={styles.generateBtn}>
            Generate
          </button>
        </form>

        <div className={styles.cardArea}>
          {notFound ? (
            <div className={styles.notFound}>
              <span className={styles.notFoundIcon}>?</span>
              <p className={styles.notFoundText}>
                Profile not available for <strong>{input}</strong>
              </p>
              <p className={styles.notFoundHint}>
                Try: torvalds, gaearon, steipete, rauchg, sindresorhus, antirez, addyosmani, kentcdodds, sdras
              </p>
            </div>
          ) : activeProfile ? (
            <DevCard profile={activeProfile} theme={selectedTheme} />
          ) : null}
        </div>

        {/* Export actions */}
        {activeProfile && (
          <div className={styles.exportActions}>
            <button className={styles.exportBtn} onClick={handleExportPng}>
              Export PNG
            </button>
            <button className={styles.copyLinkBtn} onClick={handleCopyLink}>
              {linkCopied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        )}

        {/* Theme selector */}
        <div className={styles.themeSelector} role="group" aria-label="Card theme">
          <span className={styles.themeLabel}>Theme</span>
          <div className={styles.themeSwatches}>
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`${styles.swatch} ${selectedTheme.id === theme.id ? styles.swatchActive : ""}`}
                style={{ background: theme.background, borderColor: theme.accent }}
                onClick={() => setSelectedTheme(theme)}
                title={theme.name}
                aria-label={theme.name}
                aria-pressed={selectedTheme.id === theme.id}
              >
                <span
                  className={styles.swatchAccent}
                  style={{ background: theme.accent }}
                />
              </button>
            ))}
          </div>
          <span className={styles.themeNameLabel}>{selectedTheme.name}</span>
        </div>
      </div>

      {/* Right panel: gallery */}
      <div className={styles.galleryPanel}>
        <h3 className={styles.galleryTitle}>Notable developers</h3>
        <div className={styles.gallery}>
          {FIXTURE_PROFILES.map((profile) => (
            <button
              key={profile.username}
              className={`${styles.galleryItem} ${activeProfile?.username === profile.username ? styles.galleryItemActive : ""}`}
              onClick={() => handleGalleryClick(profile)}
              aria-pressed={activeProfile?.username === profile.username}
            >
              <DevCard
                profile={profile}
                theme={selectedTheme}
                size="mini"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
