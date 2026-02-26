import type { GitHubRepo } from "@/data/types";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "@/data/language-colors";

interface TopReposProps {
  repos: GitHubRepo[];
}

export default function TopRepos({ repos }: TopReposProps) {
  if (!repos || repos.length === 0) {
    return (
      <div style={{ color: "#94a3b8", fontSize: "0.75rem", textAlign: "center" }}>
        No public repositories
      </div>
    );
  }

  const top3 = [...repos].sort((a, b) => b.stargazerCount - a.stargazerCount).slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div
        style={{
          borderTop: "1px solid #334155",
          paddingTop: "0.5rem",
          fontSize: "0.75rem",
          fontWeight: "bold",
          color: "#94a3b8",
          marginBottom: "0.25rem",
        }}
      >
        Top Repositories
      </div>
      {top3.map((repo) => {
        const langColor = repo.language
          ? (LANGUAGE_COLORS[repo.language] ?? DEFAULT_COLOR)
          : DEFAULT_COLOR;
        return (
          <div
            key={repo.name}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.1rem",
              maxHeight: 48,
              overflow: "hidden",
            }}
          >
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontWeight: "bold",
                fontSize: "0.875rem",
                color: "#93c5fd",
                textDecoration: "none",
              }}
            >
              {repo.name}
            </a>
            {repo.description && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {repo.description}
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.75rem",
                color: "#94a3b8",
              }}
            >
              {repo.language && (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: langColor,
                    }}
                  />
                  <span>{repo.language}</span>
                </>
              )}
              <span>⭐ {repo.stargazerCount}</span>
              <span>🍴 {repo.forkCount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
