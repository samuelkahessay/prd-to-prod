import { describe, it, expect, beforeEach } from 'vitest';
import { SnippetStore } from '../store/snippet-store';

describe('SnippetStore', () => {
  let store: SnippetStore;

  beforeEach(() => {
    store = new SnippetStore();
  });

  describe('create', () => {
    it('creates a snippet with auto-generated id and timestamps', () => {
      const snippet = store.create({
        title: 'Hello',
        code: 'console.log("hello")',
        language: 'typescript',
      });
      expect(snippet.id).toBeTruthy();
      expect(snippet.title).toBe('Hello');
      expect(snippet.createdAt).toBeTruthy();
      expect(snippet.updatedAt).toBeTruthy();
      expect(snippet.description).toBe('');
      expect(snippet.tags).toEqual([]);
    });

    it('creates a snippet with description and tags', () => {
      const snippet = store.create({
        title: 'Test',
        code: 'x = 1',
        language: 'python',
        description: 'A test',
        tags: ['test', 'python'],
      });
      expect(snippet.description).toBe('A test');
      expect(snippet.tags).toEqual(['test', 'python']);
    });
  });

  describe('getById', () => {
    it('returns snippet by id', () => {
      const created = store.create({ title: 'T', code: 'c', language: 'js' });
      expect(store.getById(created.id)).toEqual(created);
    });

    it('returns undefined for unknown id', () => {
      expect(store.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns empty array initially', () => {
      expect(store.getAll()).toEqual([]);
    });

    it('returns all created snippets', () => {
      store.create({ title: 'A', code: 'a', language: 'js' });
      store.create({ title: 'B', code: 'b', language: 'ts' });
      expect(store.getAll()).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates a snippet and refreshes updatedAt', async () => {
      const created = store.create({ title: 'Old', code: 'x', language: 'js' });
      await new Promise((r) => setTimeout(r, 5));
      const updated = store.update(created.id, { title: 'New' });
      expect(updated?.title).toBe('New');
      expect(updated?.updatedAt).not.toBe(created.updatedAt);
      expect(updated?.createdAt).toBe(created.createdAt);
    });

    it('returns undefined for unknown id', () => {
      expect(store.update('bad', { title: 'x' })).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deletes a snippet and returns true', () => {
      const s = store.create({ title: 'X', code: 'x', language: 'js' });
      expect(store.delete(s.id)).toBe(true);
      expect(store.getById(s.id)).toBeUndefined();
    });

    it('returns false for unknown id', () => {
      expect(store.delete('bad')).toBe(false);
    });
  });

  describe('searchByText', () => {
    beforeEach(() => {
      store.create({ title: 'Hello World', code: 'print("hi")', language: 'python', description: 'greeting', tags: ['hello'] });
      store.create({ title: 'Sorting', code: 'arr.sort()', language: 'javascript', description: 'sort an array', tags: ['algo'] });
    });

    it('finds by title', () => {
      expect(store.searchByText('hello')).toHaveLength(1);
    });

    it('is case-insensitive', () => {
      expect(store.searchByText('HELLO')).toHaveLength(1);
    });

    it('finds by code', () => {
      expect(store.searchByText('arr.sort')).toHaveLength(1);
    });

    it('finds by description', () => {
      expect(store.searchByText('greeting')).toHaveLength(1);
    });

    it('finds by tag', () => {
      expect(store.searchByText('algo')).toHaveLength(1);
    });

    it('returns empty for no match', () => {
      expect(store.searchByText('zzz')).toHaveLength(0);
    });
  });

  describe('filterByTag', () => {
    it('returns snippets matching tag', () => {
      store.create({ title: 'A', code: 'a', language: 'js', tags: ['react'] });
      store.create({ title: 'B', code: 'b', language: 'js', tags: ['vue'] });
      expect(store.filterByTag('react')).toHaveLength(1);
    });

    it('is case-insensitive', () => {
      store.create({ title: 'A', code: 'a', language: 'js', tags: ['React'] });
      expect(store.filterByTag('react')).toHaveLength(1);
    });
  });

  describe('filterByLanguage', () => {
    it('returns snippets matching language', () => {
      store.create({ title: 'A', code: 'a', language: 'TypeScript' });
      store.create({ title: 'B', code: 'b', language: 'JavaScript' });
      expect(store.filterByLanguage('typescript')).toHaveLength(1);
    });

    it('is case-insensitive', () => {
      store.create({ title: 'A', code: 'a', language: 'Go' });
      expect(store.filterByLanguage('go')).toHaveLength(1);
    });
  });
});
