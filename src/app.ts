import express from 'express';
import path from 'path';
import { SnippetStore } from './store/snippet-store';

const app = express();
export const snippetStore = new SnippetStore();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/snippets — create snippet
app.post('/api/snippets', (req, res) => {
  const { title, code, language, description, tags } = req.body as Record<string, unknown>;
  if (!title || !code) {
    res.status(400).json({ error: 'title and code are required' });
    return;
  }
  const snippet = snippetStore.create({
    title: title as string,
    code: code as string,
    language: (language as string) ?? '',
    description: (description as string) ?? undefined,
    tags: (tags as string[]) ?? undefined,
  });
  res.status(201).json(snippet);
});

// GET /api/snippets — list all, supports ?language=X and ?tag=X
app.get('/api/snippets', (req, res) => {
  const { language, tag } = req.query as Record<string, string | undefined>;
  let snippets = snippetStore.getAll();
  if (language) snippets = snippetStore.filterByLanguage(language);
  if (tag) snippets = snippetStore.filterByTag(tag);
  res.json({ snippets, count: snippets.length });
});

// GET /api/snippets/search?q=term — full-text search
app.get('/api/snippets/search', (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q) {
    res.status(400).json({ error: 'q query parameter is required' });
    return;
  }
  const snippets = snippetStore.searchByText(q);
  res.json({ snippets, count: snippets.length });
});

// GET /api/snippets/:id — get one
app.get('/api/snippets/:id', (req, res) => {
  const snippet = snippetStore.getById(req.params.id);
  if (!snippet) {
    res.status(404).json({ error: 'Snippet not found' });
    return;
  }
  res.json(snippet);
});

// PUT /api/snippets/:id — update
app.put('/api/snippets/:id', (req, res) => {
  if (!req.body || Object.keys(req.body as object).length === 0) {
    res.status(400).json({ error: 'Request body must not be empty' });
    return;
  }
  const snippet = snippetStore.update(req.params.id, req.body as Record<string, unknown>);
  if (!snippet) {
    res.status(404).json({ error: 'Snippet not found' });
    return;
  }
  res.json(snippet);
});

// DELETE /api/snippets/:id — delete
app.delete('/api/snippets/:id', (req, res) => {
  const deleted = snippetStore.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Snippet not found' });
    return;
  }
  res.status(204).send();
});

export default app;
