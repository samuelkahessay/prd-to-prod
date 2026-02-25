import { Snippet } from '../models/snippet';

export type CreateSnippetInput = Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'> & {
  description?: string;
  tags?: string[];
};

export type UpdateSnippetInput = Partial<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>>;

export class SnippetStore {
  private store = new Map<string, Snippet>();

  private normalizeTags(tags?: string[]): string[] {
    if (!tags) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tag of tags) {
      const normalized = tag.trim().toLowerCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
    return result;
  }

  create(input: CreateSnippetInput): Snippet {
    const now = new Date().toISOString();
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      title: input.title,
      code: input.code,
      language: input.language,
      description: input.description ?? '',
      tags: this.normalizeTags(input.tags),
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(snippet.id, snippet);
    return snippet;
  }

  getById(id: string): Snippet | undefined {
    return this.store.get(id);
  }

  getAll(): Snippet[] {
    return Array.from(this.store.values());
  }

  update(id: string, input: UpdateSnippetInput): Snippet | undefined {
    const existing = this.store.get(id);
    if (!existing) return undefined;
    const updated: Snippet = {
      ...existing,
      ...input,
      tags: input.tags !== undefined ? this.normalizeTags(input.tags) : existing.tags,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  searchByText(query: string): Snippet[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  filterByTag(tag: string): Snippet[] {
    const t = tag.toLowerCase();
    return this.getAll().filter((s) => s.tags.some((st) => st.toLowerCase() === t));
  }

  filterByLanguage(language: string): Snippet[] {
    const lang = language.toLowerCase();
    return this.getAll().filter((s) => s.language.toLowerCase() === lang);
  }

  getAllTags(): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const snippet of this.getAll()) {
      for (const tag of snippet.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
