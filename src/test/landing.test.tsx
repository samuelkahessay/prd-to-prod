import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Home from '../app/page';

// Mock getPipelineData
vi.mock('../data', () => ({
  getPipelineData: vi.fn().mockResolvedValue({
    issues: [
      { number: 1, title: 'Test issue', state: 'closed', createdAt: '2025-01-01T00:00:00Z', closedAt: '2025-01-01T01:00:00Z', labels: [{ name: 'feature', color: 'blue' }] },
    ],
    pullRequests: [
      { number: 5, title: 'Test PR', state: 'merged', createdAt: '2025-01-01T00:00:00Z', mergedAt: '2025-01-01T01:00:00Z', additions: 10, deletions: 2, changedFiles: 1, reviews: [] },
    ],
    workflowRuns: [],
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/'),
}));

describe('Home page', () => {
  it('renders three view cards with correct href links', async () => {
    const page = await Home();
    render(page);

    const simulatorLink = screen.getByRole('link', { name: /simulator/i });
    const replayLink = screen.getByRole('link', { name: /replay/i });
    const forensicsLink = screen.getByRole('link', { name: /forensics/i });

    expect(simulatorLink).toHaveAttribute('href', '/simulator');
    expect(replayLink).toHaveAttribute('href', '/replay');
    expect(forensicsLink).toHaveAttribute('href', '/forensics');
  });

  it('renders the hero heading', async () => {
    const page = await Home();
    render(page);
    expect(screen.getAllByText('Pipeline Observatory').length).toBeGreaterThan(0);
  });
});
