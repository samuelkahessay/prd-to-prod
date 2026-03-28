"use client";

import { useState, useEffect, useCallback } from "react";

export interface Snippet {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: string;
}

const STORAGE_KEY = "showcase-snippets";
const SEEDED_KEY = "showcase-snippets-seeded";

const SEED_SNIPPETS: Snippet[] = [
  {
    id: "seed-1",
    title: "Debounce",
    description: "Generic debounce utility — delays invocation until after a pause in calls.",
    code: `function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Usage: debounce search input
const handleSearch = debounce((q: string) => {
  fetch(\`/api/search?q=\${encodeURIComponent(q)}\`);
}, 300);`,
    language: "TypeScript",
    tags: ["utility", "async"],
    createdAt: "2026-02-01T10:00:00Z",
  },
  {
    id: "seed-2",
    title: "Read File",
    description: "Read a text file line-by-line and count non-empty lines.",
    code: `from pathlib import Path


def count_lines(filepath: str) -> int:
    """Count non-empty lines in a text file."""
    text = Path(filepath).read_text(encoding="utf-8")
    return sum(1 for line in text.splitlines() if line.strip())


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "README.md"
    print(f"{path}: {count_lines(path)} non-empty lines")`,
    language: "Python",
    tags: ["file-io", "utility"],
    createdAt: "2026-02-02T10:00:00Z",
  },
  {
    id: "seed-3",
    title: "Fibonacci",
    description: "Iterative Fibonacci with compile-time overflow protection.",
    code: `fn fibonacci(n: u32) -> u64 {
    let (mut a, mut b): (u64, u64) = (0, 1);
    for _ in 0..n {
        let tmp = b;
        b = a.checked_add(b).expect("overflow");
        a = tmp;
    }
    a
}

fn main() {
    for i in 0..=20 {
        println!("fib({i}) = {}", fibonacci(i));
    }
}`,
    language: "Rust",
    tags: ["algorithms", "math"],
    createdAt: "2026-02-03T10:00:00Z",
  },
  {
    id: "seed-4",
    title: "HTTP GET",
    description: "Minimal HTTP GET with timeout and JSON decoding.",
    code: `package main

import (
\t"encoding/json"
\t"fmt"
\t"net/http"
\t"time"
)

func fetchJSON(url string, dest interface{}) error {
\tclient := &http.Client{Timeout: 10 * time.Second}
\tresp, err := client.Get(url)
\tif err != nil {
\t\treturn err
\t}
\tdefer resp.Body.Close()
\treturn json.NewDecoder(resp.Body).Decode(dest)
}

func main() {
\tvar data map[string]interface{}
\tif err := fetchJSON("https://api.github.com/zen", &data); err != nil {
\t\tfmt.Println("error:", err)
\t}
\tfmt.Println(data)
}`,
    language: "Go",
    tags: ["networking", "http"],
    createdAt: "2026-02-04T10:00:00Z",
  },
  {
    id: "seed-5",
    title: "Recent Active Users",
    description: "Find users active in the last 30 days with their order counts.",
    code: `SELECT
  u.id,
  u.email,
  u.display_name,
  COUNT(o.id) AS order_count,
  MAX(o.created_at) AS last_order
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.display_name
HAVING COUNT(o.id) >= 2
ORDER BY order_count DESC
LIMIT 50;`,
    language: "SQL",
    tags: ["database", "query"],
    createdAt: "2026-02-05T10:00:00Z",
  },
  {
    id: "seed-6",
    title: "Backup Script",
    description: "Timestamped compressed backup with automatic cleanup of old archives.",
    code: `#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="\${1:?Usage: backup.sh <source> <dest>}"
DEST_DIR="\${2:?Usage: backup.sh <source> <dest>}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="\${DEST_DIR}/backup-\${TIMESTAMP}.tar.gz"

mkdir -p "\${DEST_DIR}"
tar czf "\${ARCHIVE}" -C "\${SRC_DIR}" .
echo "Created \${ARCHIVE} ($(du -h "\${ARCHIVE}" | cut -f1))"

# Keep only the 7 most recent backups
ls -1t "\${DEST_DIR}"/backup-*.tar.gz | tail -n +8 | xargs -r rm --
echo "Cleanup complete — $(ls "\${DEST_DIR}"/backup-*.tar.gz | wc -l) backups retained"`,
    language: "Bash",
    tags: ["devops", "automation"],
    createdAt: "2026-02-06T10:00:00Z",
  },
];

function loadFromStorage(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Snippet[];
  } catch {
    return [];
  }
}

function saveToStorage(snippets: Snippet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  } catch {
    // ignore storage errors
  }
}

function seedIfNeeded(): Snippet[] {
  try {
    if (localStorage.getItem(SEEDED_KEY)) {
      return loadFromStorage();
    }
    saveToStorage(SEED_SNIPPETS);
    localStorage.setItem(SEEDED_KEY, "1");
    return SEED_SNIPPETS;
  } catch {
    return SEED_SNIPPETS;
  }
}

export function useSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = seedIfNeeded();
    setSnippets(loaded);
    setHydrated(true);
  }, []);

  const addSnippet = useCallback(
    (data: Omit<Snippet, "id" | "createdAt" | "description"> & { description?: string }) => {
      const next: Snippet = {
        ...data,
        description: data.description ?? "",
        id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setSnippets((prev) => {
        const updated = [next, ...prev];
        saveToStorage(updated);
        return updated;
      });
    },
    []
  );

  const deleteSnippet = useCallback((id: string) => {
    setSnippets((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const searchSnippets = useCallback(
    (query: string): Snippet[] => {
      if (!query.trim()) return snippets;
      const q = query.toLowerCase();
      return snippets.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q)
      );
    },
    [snippets]
  );

  return { snippets, hydrated, addSnippet, deleteSnippet, searchSnippets };
}
