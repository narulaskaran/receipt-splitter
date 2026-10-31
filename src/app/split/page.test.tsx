import { render, screen, waitFor } from "@testing-library/react";
import SplitPage from "./page";

let mockSearch = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

// Helper to render with specific query string
function renderWithQuery(query: string) {
  mockSearch = query.startsWith("?") ? query.slice(1) : query;
  render(<SplitPage />);
}

describe("/split route (client) with query params", () => {
  it("renders split summary when amounts differ from total but within per-person rounding tolerance", async () => {
    const query =
      "names=Jon%2CJane%2CDavid%2CSara&amounts=15.25%2C21.75%2C15.25%2C15.25&total=67.52&note=Love+Mama&phone=5551234567&date=2025-09-05";
    renderWithQuery(query);

    // Wait for final content
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Love Mama" })).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.getByText("$67.52")).toBeInTheDocument();
    });

    for (const name of ["Jon", "Jane", "David", "Sara"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("shows the Ko-fi support banner on a valid split", async () => {
    renderWithQuery(
      "names=Jon%2CJane&amounts=10.00%2C20.00&total=30.00&note=Lunch&phone=5551234567"
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /tip/i })).toBeInTheDocument();
    });
  });

  it("renders a split that was shared without a phone number", async () => {
    renderWithQuery(
      "names=Jon%2CJane&amounts=10.00%2C20.00&total=30.00&note=Lunch"
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Lunch" })).toBeInTheDocument();
    });
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Payment details weren't included — pay however you prefer."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /with Venmo/i })).not.toBeInTheDocument();
  });

  it("still rejects a link whose phone number is not a US Venmo number", async () => {
    renderWithQuery(
      "names=Jon%2CJane&amounts=10.00%2C20.00&total=30.00&note=Lunch&phone=123"
    );

    await waitFor(() => {
      expect(screen.getByText(/Unable to Load Split/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/format is invalid/i)).toBeInTheDocument();
  });

  it("shows error UI for obviously invalid params", async () => {
    const bad =
      "names=A%2CB&amounts=10.00%2C20.00&total=99.99&note=Bad&phone=5551234567";
    renderWithQuery(bad);

    await waitFor(() => {
      expect(screen.getByText(/Unable to Load Split/i)).toBeInTheDocument();
    });
  });
});
