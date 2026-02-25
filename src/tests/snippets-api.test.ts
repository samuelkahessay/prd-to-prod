import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app, { snippetStore } from '../app';

describe('Snippets CRUD API', () => {
  beforeEach(() => {
    // Clear store between tests by replacing internal map
    (snippetStore as unknown as { store: Map<string, unknown> }).store.clear();
  });

  describe('POST /api/snippets', () => {
    it('creates a snippet and returns 201', async () => {
      const res = await request(app).post('/api/snippets').send({
        title: 'My Snippet',
        code: 'console.log("hi")',
        language: 'typescript',
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.title).toBe('My Snippet');
    });

    it('returns 400 if title missing', async () => {
      const res = await request(app).post('/api/snippets').send({ code: 'x', language: 'js' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 400 if code missing', async () => {
      const res = await request(app).post('/api/snippets').send({ title: 'T', language: 'js' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('GET /api/snippets', () => {
    it('returns all snippets', async () => {
      await request(app).post('/api/snippets').send({ title: 'A', code: 'a', language: 'js' });
      await request(app).post('/api/snippets').send({ title: 'B', code: 'b', language: 'ts' });
      const res = await request(app).get('/api/snippets');
      expect(res.status).toBe(200);
      expect(res.body.snippets).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('filters by language', async () => {
      await request(app).post('/api/snippets').send({ title: 'A', code: 'a', language: 'javascript' });
      await request(app).post('/api/snippets').send({ title: 'B', code: 'b', language: 'python' });
      const res = await request(app).get('/api/snippets?language=javascript');
      expect(res.status).toBe(200);
      expect(res.body.snippets).toHaveLength(1);
      expect(res.body.snippets[0].language).toBe('javascript');
    });

    it('filters by tag', async () => {
      await request(app).post('/api/snippets').send({ title: 'A', code: 'a', language: 'js', tags: ['react'] });
      await request(app).post('/api/snippets').send({ title: 'B', code: 'b', language: 'js', tags: ['vue'] });
      const res = await request(app).get('/api/snippets?tag=react');
      expect(res.status).toBe(200);
      expect(res.body.snippets).toHaveLength(1);
    });
  });

  describe('GET /api/snippets/:id', () => {
    it('returns snippet by id', async () => {
      const created = await request(app).post('/api/snippets').send({ title: 'T', code: 'c', language: 'js' });
      const res = await request(app).get(`/api/snippets/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/snippets/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('PUT /api/snippets/:id', () => {
    it('updates a snippet', async () => {
      const created = await request(app).post('/api/snippets').send({ title: 'Old', code: 'x', language: 'js' });
      const res = await request(app).put(`/api/snippets/${created.body.id}`).send({ title: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).put('/api/snippets/bad').send({ title: 'X' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 400 if body is empty', async () => {
      const created = await request(app).post('/api/snippets').send({ title: 'T', code: 'c', language: 'js' });
      const res = await request(app).put(`/api/snippets/${created.body.id}`).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('DELETE /api/snippets/:id', () => {
    it('deletes a snippet and returns 204', async () => {
      const created = await request(app).post('/api/snippets').send({ title: 'T', code: 'c', language: 'js' });
      const res = await request(app).delete(`/api/snippets/${created.body.id}`);
      expect(res.status).toBe(204);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).delete('/api/snippets/bad');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });
});
