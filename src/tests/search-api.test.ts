import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app, { snippetStore } from '../app';

describe('Search API', () => {
  beforeEach(() => {
    (snippetStore as unknown as { store: Map<string, unknown> }).store.clear();
  });

  it('returns 400 if q is missing', async () => {
    const res = await request(app).get('/api/snippets/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns matching snippets with query field', async () => {
    await request(app).post('/api/snippets').send({ title: 'Hello World', code: 'print("hello")', language: 'python' });
    await request(app).post('/api/snippets').send({ title: 'Foo', code: 'x = 1', language: 'python' });
    const res = await request(app).get('/api/snippets/search?q=hello');
    expect(res.status).toBe(200);
    expect(res.body.snippets).toHaveLength(1);
    expect(res.body.count).toBe(1);
    expect(res.body.query).toBe('hello');
    expect(res.body.snippets[0].title).toBe('Hello World');
  });

  it('is case-insensitive', async () => {
    await request(app).post('/api/snippets').send({ title: 'JavaScript Tips', code: 'const x = 1', language: 'js' });
    const res = await request(app).get('/api/snippets/search?q=javascript');
    expect(res.status).toBe(200);
    expect(res.body.snippets).toHaveLength(1);
  });

  it('supports partial matching', async () => {
    await request(app).post('/api/snippets').send({ title: 'TypeScript Generics', code: 'function id<T>(x: T): T { return x; }', language: 'ts' });
    const res = await request(app).get('/api/snippets/search?q=Generic');
    expect(res.status).toBe(200);
    expect(res.body.snippets).toHaveLength(1);
  });

  it('returns empty array for no matches', async () => {
    await request(app).post('/api/snippets').send({ title: 'Foo', code: 'bar', language: 'js' });
    const res = await request(app).get('/api/snippets/search?q=zzznomatch');
    expect(res.status).toBe(200);
    expect(res.body.snippets).toHaveLength(0);
    expect(res.body.count).toBe(0);
    expect(res.body.query).toBe('zzznomatch');
  });

  it('searches in description', async () => {
    await request(app).post('/api/snippets').send({ title: 'A', code: 'x', language: 'js', description: 'utility function for sorting' });
    const res = await request(app).get('/api/snippets/search?q=sorting');
    expect(res.status).toBe(200);
    expect(res.body.snippets).toHaveLength(1);
  });

  it('searches in tags', async () => {
    await request(app).post('/api/snippets').send({ title: 'A', code: 'x', language: 'js', tags: ['algorithms'] });
    const res = await request(app).get('/api/snippets/search?q=algo');
    expect(res.status).toBe(200);
    expect(res.body.snippets).toHaveLength(1);
  });
});
