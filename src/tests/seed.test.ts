import { describe, it, expect, beforeEach } from 'vitest';
import { SnippetStore } from '../store/snippet-store';
import { seedSnippets } from '../seed';

describe('seedSnippets', () => {
  let store: SnippetStore;

  beforeEach(() => {
    store = new SnippetStore();
    seedSnippets(store);
  });

  it('loads at least 6 snippets', () => {
    expect(store.getAll().length).toBeGreaterThanOrEqual(6);
  });

  it('covers TypeScript language', () => {
    const ts = store.filterByLanguage('typescript');
    expect(ts.length).toBeGreaterThan(0);
  });

  it('covers Python language', () => {
    expect(store.filterByLanguage('python').length).toBeGreaterThan(0);
  });

  it('covers Rust language', () => {
    expect(store.filterByLanguage('rust').length).toBeGreaterThan(0);
  });

  it('covers Go language', () => {
    expect(store.filterByLanguage('go').length).toBeGreaterThan(0);
  });

  it('covers SQL language', () => {
    expect(store.filterByLanguage('sql').length).toBeGreaterThan(0);
  });

  it('covers Bash language', () => {
    expect(store.filterByLanguage('bash').length).toBeGreaterThan(0);
  });

  it('each snippet has non-empty title, code and language', () => {
    for (const snippet of store.getAll()) {
      expect(snippet.title.trim()).not.toBe('');
      expect(snippet.code.trim()).not.toBe('');
      expect(snippet.language.trim()).not.toBe('');
    }
  });

  it('each snippet has at least one tag', () => {
    for (const snippet of store.getAll()) {
      expect(snippet.tags.length).toBeGreaterThan(0);
    }
  });

  it('calling seedSnippets twice doubles the count', () => {
    const countBefore = store.getAll().length;
    seedSnippets(store);
    expect(store.getAll().length).toBe(countBefore * 2);
  });
});
