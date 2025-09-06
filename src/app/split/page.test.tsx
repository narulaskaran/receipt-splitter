import { render, screen, waitFor } from '@testing-library/react';
import SplitPage from './page';

// Helper to render with specific URL
function renderWithSearch(search: string) {
  const original = window.location;
  Object.defineProperty(window, 'location', {
    value: new URL(`http://localhost${search}`),
    writable: true,
  });
  render(<SplitPage />);
  // restore not strictly necessary in JSDOM process isolation
  Object.defineProperty(window, 'location', { value: original });
}

describe('/split route (client) with query params', () => {
  it('renders split summary for provided URL parameters', async () => {
    const query = '?names=I%2CK%2Cp%2Cs&amounts=15.25%2C21.75%2C15.25%2C15.25&total=67.52&note=Love+Mama&phone=4259749530&date=2025-09-05';
    renderWithSearch(`/split${query}`);

    // Suspense fallback first
    expect(screen.getByText(/Loading Split Details/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Receipt Split')).toBeInTheDocument();
      expect(screen.getByText('Total Bill')).toBeInTheDocument();
      expect(screen.getByText('$67.52')).toBeInTheDocument();
    });

    for (const name of ['I', 'K', 'p', 's']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('shows error UI for obviously invalid params', async () => {
    const bad = '?names=A%2CB&amounts=10.00%2C20.00&total=99.99&note=Bad&phone=5551234567';
    renderWithSearch(`/split${bad}`);

    await waitFor(() => {
      expect(screen.getByText(/Unable to Load Split/i)).toBeInTheDocument();
    });
  });
});

