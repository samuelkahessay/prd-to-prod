import { SnippetStore } from './store/snippet-store';

export function seedSnippets(store: SnippetStore): void {
  store.create({
    title: 'Debounce Function',
    language: 'typescript',
    code: `function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}`,
    description: 'Delays invoking a function until after a specified wait time has elapsed since the last call.',
    tags: ['utils', 'async', 'performance'],
  });

  store.create({
    title: 'Read File Lines in Python',
    language: 'python',
    code: `def read_lines(filepath: str) -> list[str]:
    with open(filepath, 'r', encoding='utf-8') as f:
        return [line.rstrip('\\n') for line in f]`,
    description: 'Reads a file and returns its lines as a list, stripping trailing newlines.',
    tags: ['io', 'file', 'python'],
  });

  store.create({
    title: 'Fibonacci Iterator in Rust',
    language: 'rust',
    code: `struct Fibonacci {
    a: u64,
    b: u64,
}

impl Fibonacci {
    fn new() -> Self { Self { a: 0, b: 1 } }
}

impl Iterator for Fibonacci {
    type Item = u64;
    fn next(&mut self) -> Option<Self::Item> {
        let next = self.a + self.b;
        self.a = self.b;
        self.b = next;
        Some(self.a)
    }
}`,
    description: 'An iterator that yields Fibonacci numbers indefinitely.',
    tags: ['iterator', 'math', 'rust'],
  });

  store.create({
    title: 'HTTP GET with Context in Go',
    language: 'go',
    code: `func fetchURL(ctx context.Context, url string) ([]byte, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil {
        return nil, err
    }
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    return io.ReadAll(resp.Body)
}`,
    description: 'Performs a context-aware HTTP GET request and returns the response body.',
    tags: ['http', 'networking', 'go'],
  });

  store.create({
    title: 'Find Top N Customers by Revenue',
    language: 'sql',
    code: `SELECT
    c.id,
    c.name,
    SUM(o.total_amount) AS total_revenue
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'completed'
GROUP BY c.id, c.name
ORDER BY total_revenue DESC
LIMIT 10;`,
    description: 'Returns the top 10 customers ranked by total completed order revenue.',
    tags: ['sql', 'analytics', 'database'],
  });

  store.create({
    title: 'Backup Directory with Timestamp',
    language: 'bash',
    code: '#!/usr/bin/env bash\nset -euo pipefail\n\nSRC="${1:?Usage: backup.sh <source> <dest>}"\nDEST="${2:?Usage: backup.sh <source> <dest>}"\nTIMESTAMP=$(date +%Y%m%d_%H%M%S)\n\ntar -czf "${DEST}/backup_${TIMESTAMP}.tar.gz" -C "$(dirname "$SRC")" "$(basename "$SRC")"\necho "Backup saved to ${DEST}/backup_${TIMESTAMP}.tar.gz"',
    description: 'Creates a timestamped gzipped tar archive of a directory.',
    tags: ['bash', 'backup', 'devops'],
  });
}
