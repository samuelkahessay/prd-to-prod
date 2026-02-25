import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app, { snippetStore } from '../app';

describe('Tags API', () => {
  beforeEach(() => {
    (snippetStore as unknown as { store: Map<string, unknown> }).store.clear();
  });

  describe('GET /api/tags', () => {
    it('returns empty tags array when no snippets', async () => {
      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual([]);
    });

    it('returns tags with counts', async () => {
      await request(app).post('/api/snippets').send({ title: 'A', code: 'a', language: 'js', tags: ['react', 'frontend'] });
      await request(app).post('/api/snippets').send({ title: 'B', code: 'b', language: 'ts', tags: ['react'] });
      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body.tags).toHaveLength(2);
      const reactTag = res.body.tags.find((t: { name: string; count: number }) => t.name === 'react');
      expect(reactTag).toBeDefined();
      expect(reactTag.count).toBe(2);
      const frontendTag = res.body.tags.find((t: { name: string; count: number }) => t.name === 'frontend');
      expect(frontendTag).toBeDefined();
      expect(frontendTag.count).toBe(1);
    });
  });

  describe('GET /api/tags/:tag/snippets', () => {
    it('returns snippets for a tag', async () => {
      await request(app).post('/api/snippets').send({ title: 'A', code: 'a', language: 'js', tags: ['react'] });
      await request(app).post('/api/snippets').send({ title: 'B', code: 'b', language: 'ts', tags: ['vue'] });
      const res = await request(app).get('/api/tags/react/snippets');
      expect(res.status).toBe(200);
      expect(res.body.snippets).toHaveLength(1);
      expect(res.body.count).toBe(1);
      expect(res.body.snippets[0].title).toBe('A');
    });

    it('returns empty array for unknown tag', async () => {
      const res = await request(app).get('/api/tags/nonexistent/snippets');
      expect(res.status).toBe(200);
      expect(res.body.snippets).toHaveLength(0);
      expect(res.body.count).toBe(0);
    });
  });

  describe('Tag normalization', () => {
    it('normalizes tags to lowercase on create', async () => {
      const res = await request(app).post('/api/snippets').send({
        title: 'A', code: 'a', language: 'js', tags: ['React', 'FRONTEND', 'TypeScript'],
      });
      expect(res.status).toBe(201);
      expect(res.body.tags).toEqual(['react', 'frontend', 'typescript']);
    });

    it('trims whitespace from tags on create', async () => {
      const res = await request(app).post('/api/snippets').send({
        title: 'A', code: 'a', language: 'js', tags: ['  react  ', ' node '],
      });
      expect(res.status).toBe(201);
      expect(res.body.tags).toContain('react');
      expect(res.body.tags).toContain('node');
    });

    it('removes duplicate tags on create', async () => {
      const res = await request(app).post('/api/snippets').send({
        title: 'A', code: 'a', language: 'js', tags: ['react', 'React', 'REACT'],
      });
      expect(res.status).toBe(201);
      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0]).toBe('react');
    });

    it('normalizes tags on update', async () => {
      const created = await request(app).post('/api/snippets').send({ title: 'A', code: 'a', language: 'js' });
      const res = await request(app).put(`/api/snippets/${created.body.id}`).send({ tags: ['VUE', 'VUE', '  vue  '] });
      expect(res.status).toBe(200);
      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0]).toBe('vue');
    });
  });
});
