"use client";

import { useState, useMemo } from "react";
import { useSnippets, type Snippet } from "./store";
import styles from "./app.module.css";

// ── Language badge colors ──────────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  javascript: "var(--accent)",
  typescript: "var(--good)",
  css: "var(--policy)",
  html: "var(--heal)",
  python: "var(--accent)",
  go: "var(--good)",
  rust: "var(--heal)",
  bash: "var(--ink-mid)",
  sql: "var(--policy)",
};

function langColor(language: string): string {
  return LANG_COLORS[language.toLowerCase()] ?? "var(--ink-mid)";
}

const LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "CSS",
  "HTML",
  "Go",
  "Rust",
  "Bash",
  "SQL",
  "Other",
];

// ── Sub-components ────────────────────────────────────────────────────────

function SnippetCard({
  snippet,
  onDelete,
  expanded,
  onToggle,
}: {
  snippet: Snippet;
  onDelete: (id: string) => void;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const preview = snippet.code.split("\n").slice(0, 4).join("\n");

  return (
    <article className={`${styles.card} ${expanded ? styles.cardExpanded : ""}`}>
      <div
        className={styles.cardHeader}
        onClick={() => onToggle(snippet.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle(snippet.id);
        }}
        aria-expanded={expanded}
      >
        <div className={styles.cardMeta}>
          <h3 className={styles.cardTitle}>{snippet.title}</h3>
          <span
            className={styles.langBadge}
            style={{ "--lang-color": langColor(snippet.language) } as React.CSSProperties}
          >
            {snippet.language}
          </span>
        </div>

        {snippet.tags.length > 0 && (
          <div className={styles.tagRow}>
            {snippet.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {!expanded && (
          <pre className={styles.codePreview} aria-hidden>
            <code>{preview}</code>
          </pre>
        )}

        <span className={styles.expandIcon} aria-hidden>
          {expanded ? "↑" : "↓"}
        </span>
      </div>

      {expanded && (
        <div className={styles.cardBody}>
          <pre className={styles.codeBlock}>
            <code>{snippet.code}</code>
          </pre>

          <div className={styles.cardFooter}>
            <time className={styles.timestamp}>
              {new Date(snippet.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
            <button
              className={styles.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(snippet.id);
              }}
              aria-label={`Delete "${snippet.title}"`}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

interface NewSnippetFormData {
  title: string;
  code: string;
  language: string;
  tags: string;
}

function NewSnippetForm({
  onSave,
  onCancel,
}: {
  onSave: (data: Omit<import("./store").Snippet, "id" | "createdAt" | "description"> & { description?: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NewSnippetFormData>({
    title: "",
    code: "",
    language: "JavaScript",
    tags: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.code.trim()) return;
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({ title: form.title.trim(), code: form.code, language: form.language, tags });
  }

  return (
    <form className={styles.newForm} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>New snippet</h3>

      <label className={styles.formLabel}>
        Title
        <input
          className={styles.formInput}
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Debounce function"
          required
          autoFocus
        />
      </label>

      <label className={styles.formLabel}>
        Language
        <select
          className={styles.formSelect}
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.formLabel}>
        Code
        <textarea
          className={styles.formTextarea}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="Paste your code here…"
          rows={8}
          required
          spellCheck={false}
        />
      </label>

      <label className={styles.formLabel}>
        Tags{" "}
        <span className={styles.formHint}>(comma-separated)</span>
        <input
          className={styles.formInput}
          type="text"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="e.g. utils, async"
        />
      </label>

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn}>
          Save snippet
        </button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────

export default function App() {
  const { snippets, hydrated, addSnippet, deleteSnippet, searchSnippets } =
    useSnippets();

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // All unique tags across all snippets
  const allTags = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [snippets]);

  // Filtered snippets: search + tag
  const visible = useMemo(() => {
    let result = query.trim() ? searchSnippets(query) : snippets;
    if (activeTag) {
      result = result.filter((s) => s.tags.includes(activeTag));
    }
    return result;
  }, [query, activeTag, snippets, searchSnippets]);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleSave(data: Omit<Snippet, "id" | "createdAt" | "description"> & { description?: string }) {
    addSnippet(data);
    setShowForm(false);
  }

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag));
    setExpandedId(null);
  }

  if (!hydrated) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.shell}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden>
            ⌕
          </span>
          <input
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpandedId(null);
            }}
            placeholder="Search snippets…"
            aria-label="Search snippets"
          />
          {query && (
            <button
              className={styles.clearBtn}
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <button
          className={styles.newBtn}
          onClick={() => {
            setShowForm((v) => !v);
            setExpandedId(null);
          }}
          aria-expanded={showForm}
        >
          {showForm ? "Cancel" : "+ New snippet"}
        </button>
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div className={styles.tagFilters} role="group" aria-label="Filter by tag">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`${styles.tagFilter} ${activeTag === tag ? styles.tagFilterActive : ""}`}
              onClick={() => handleTagClick(tag)}
              aria-pressed={activeTag === tag}
            >
              {tag}
            </button>
          ))}
          {activeTag && (
            <button
              className={styles.tagFilterClear}
              onClick={() => setActiveTag(null)}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <NewSnippetForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Snippet list */}
      <div className={styles.list}>
        {visible.length === 0 ? (
          <div className={styles.empty}>
            {query || activeTag
              ? "No snippets match your search."
              : "No snippets yet. Create your first one!"}
          </div>
        ) : (
          visible.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onDelete={deleteSnippet}
              expanded={expandedId === snippet.id}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      {snippets.length > 0 && (
        <div className={styles.footer}>
          {visible.length === snippets.length
            ? `${snippets.length} snippet${snippets.length !== 1 ? "s" : ""}`
            : `${visible.length} of ${snippets.length} snippets`}
        </div>
      )}
    </div>
  );
}
