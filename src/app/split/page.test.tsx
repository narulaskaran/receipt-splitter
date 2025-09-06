import { render, screen, waitFor } from '@testing-library/react';
import SplitPage from './page';

let mockSearch = '';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

// Helper to render with specific query string
function renderWithQuery(query: string) {
  mockSearch = query.startsWith('?') ? query.slice(1) : query;
  render(<SplitPage />);
}

describe('/split route (client) with query params', () => {
  it('renders split summary when amounts differ from total but within per-person rounding tolerance', async () => {
    const query = 'names=Jon%2CJane%2CDavid%2CSara&amounts=15.25%2C21.75%2C15.25%2C15.25&total=67.52&note=Love+Mama&phone=4259749530&date=2025-09-05';
    renderWithQuery(query);

    // Suspense fallback first
    expect(screen.getByText(/Loading Split Details/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Receipt Split')).toBeInTheDocument();
      expect(screen.getByText('Total Bill')).toBeInTheDocument();
      expect(screen.getByText('$67.52')).toBeInTheDocument();
    });

    for (const name of ['Jon', 'Jane', 'David', 'Sara']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('shows error UI for obviously invalid params', async () => {
    const bad = 'names=A%2CB&amounts=10.00%2C20.00&total=99.99&note=Bad&phone=5551234567';
    renderWithQuery(bad);

    await waitFor(() => {
      expect(screen.getByText(/Unable to Load Split/i)).toBeInTheDocument();
    });
  });
});

