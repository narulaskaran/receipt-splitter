import { render, screen, waitFor } from "@testing-library/react";
import { SplitSummary } from "./split-summary";
import { type SharedSplitData } from "@/lib/split-sharing";

jest.mock("@/lib/receipt-utils", () => ({
  formatCurrency: jest.fn((amount: number) => `$${amount.toFixed(2)}`),
}));

const originalUserAgent = navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: ua,
  });
}

const mockSplitData: SharedSplitData = {
  names: ["Alice", "Bob", "Charlie"],
  amounts: [32.5, 19.5, 13.0],
  total: 65.0,
  note: "Pizza Palace",
  phone: "5551234567",
  currency: "USD",
  date: "2024-01-15",
};

const mockMinimalSplitData: SharedSplitData = {
  names: ["Alice"],
  amounts: [25.0],
  total: 25.0,
  note: "Test Split",
  phone: "5551234567",
  currency: "USD",
};

describe("SplitSummary", () => {
  beforeEach(() => {
    // Default the suite to a phone user agent so Pay links resolve to the
    // native app scheme; the desktop fallback has its own test below.
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
  });

  afterEach(() => {
    setUserAgent(originalUserAgent);
  });
  it("renders restaurant, total, date, and people", () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    expect(
      screen.getByRole("heading", { name: "Pizza Palace" })
    ).toBeInTheDocument();
    expect(screen.getByText("Mon, Jan 15, 2024 · 3 people")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("$65.00")).toBeInTheDocument();

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("$32.50")).toBeInTheDocument();
    expect(screen.getByText("$19.50")).toBeInTheDocument();
    expect(screen.getByText("$13.00")).toBeInTheDocument();
  });

  it("omits the date when it is not provided", () => {
    render(
      <SplitSummary splitData={mockMinimalSplitData} phoneNumber="5551234567" />
    );

    expect(
      screen.getByRole("heading", { name: "Test Split" })
    ).toBeInTheDocument();
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.queryByText(/Jan/)).not.toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getAllByText("$25.00").length).toBeGreaterThan(0);
  });

  it("formats dates without shifting the calendar day", () => {
    const splitDataWithDate: SharedSplitData = {
      ...mockMinimalSplitData,
      date: "2024-12-25",
    };

    render(
      <SplitSummary splitData={splitDataWithDate} phoneNumber="5551234567" />
    );

    expect(screen.getByText(/Wed, Dec 25, 2024 · 1 person/)).toBeInTheDocument();
  });

  it("handles invalid date gracefully", () => {
    const splitDataWithBadDate: SharedSplitData = {
      ...mockMinimalSplitData,
      date: "invalid-date",
    };

    render(
      <SplitSummary splitData={splitDataWithBadDate} phoneNumber="5551234567" />
    );

    expect(screen.getByText(/invalid-date · 1 person/)).toBeInTheDocument();
  });

  it("keeps long restaurant names in the document", () => {
    const longNoteData: SharedSplitData = {
      ...mockMinimalSplitData,
      note: "This is a very long restaurant name that should be truncated properly",
    };

    render(<SplitSummary splitData={longNoteData} phoneNumber="5551234567" />);

    expect(
      screen.getByRole("heading", {
        name: "This is a very long restaurant name that should be truncated properly",
      })
    ).toBeInTheDocument();
  });

  it("shows Venmo pay actions for USD splits", () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    expect(
      screen.getByRole("link", { name: "Pay $32.50 for Alice with Venmo" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Pay $19.50 for Bob with Venmo" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Pay $13.00 for Charlie with Venmo" })
    ).toBeInTheDocument();
  });

  it("links Pay actions to the native Venmo paycharge URL on mobile", async () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    const payLink = await screen.findByRole("link", {
      name: "Pay $32.50 for Alice with Venmo",
    });

    await waitFor(() =>
      expect(payLink.getAttribute("href")).toContain("venmo://paycharge")
    );
    expect(payLink).toHaveAttribute(
      "href",
      "venmo://paycharge?txn=pay&recipients=5551234567&amount=32.50&note=Pizza%20Palace%20-%20Alice"
    );
    expect(payLink.getAttribute("href")).not.toContain("+");
  });

  it("falls back to the web compose URL for desktop user agents", async () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    );
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    const payLink = screen.getByRole("link", {
      name: "Pay $32.50 for Alice with Venmo",
    });

    await waitFor(() =>
      expect(payLink.getAttribute("href")).toContain("https://venmo.com/pay")
    );
    expect(payLink).toHaveAttribute(
      "href",
      "https://venmo.com/pay?txn=pay&recipients=5551234567&amount=32.50&note=Pizza%20Palace%20-%20Alice"
    );
    expect(payLink.getAttribute("href")).not.toContain("+");
  });

  it("encodes restaurant names with spaces as %20 in the Pay href", () => {
    const splitData: SharedSplitData = {
      ...mockMinimalSplitData,
      names: ["anuraag"],
      amounts: [25.8],
      total: 25.8,
      note: "ANGEL INDIAN RESTAURANT",
    };

    render(<SplitSummary splitData={splitData} phoneNumber="5551234567" />);

    const payLink = screen.getByRole("link", {
      name: "Pay $25.80 for anuraag with Venmo",
    });

    expect(payLink).toHaveAttribute(
      "href",
      "venmo://paycharge?txn=pay&recipients=5551234567&amount=25.80&note=ANGEL%20INDIAN%20RESTAURANT%20-%20anuraag"
    );
    expect(payLink.getAttribute("href")).not.toContain("+");
  });

  it("always shows amounts even without a payment phone number", () => {
    render(<SplitSummary splitData={mockSplitData} />);

    expect(screen.getByText("$32.50")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /with Venmo/i })
    ).not.toBeInTheDocument();
  });

  it("hides Venmo actions for non-USD currencies but still shows amounts", () => {
    const euroSplit: SharedSplitData = {
      ...mockSplitData,
      currency: "EUR",
    };

    render(<SplitSummary splitData={euroSplit} phoneNumber="5551234567" />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("$32.50")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /with Venmo/i })
    ).not.toBeInTheDocument();
  });

  it("renders multi-receipt amounts without adding per-receipt Venmo actions", () => {
    const splitData: SharedSplitData = {
      names: ["Alice", "Bob"],
      amounts: [30, 20],
      total: 50,
      note: "Dinner Split",
      phone: "5551234567",
      currency: "USD",
      receipts: [
        { label: "Cafe", amounts: [12, 8] },
        { label: "Dessert Bar", amounts: [18, 12] },
      ],
    };

    render(<SplitSummary splitData={splitData} phoneNumber={splitData.phone} />);

    expect(screen.getByRole("heading", { name: "By receipt" })).toBeInTheDocument();
    expect(screen.getByText("Cafe")).toBeInTheDocument();
    expect(screen.getByText("Dessert Bar")).toBeInTheDocument();
    expect(screen.getAllByText("$12.00")).toHaveLength(2);
    expect(screen.getByText("$8.00")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Pay/ })).toHaveLength(2);
  });
});
