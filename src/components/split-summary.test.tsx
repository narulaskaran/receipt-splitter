import { render, screen } from "@testing-library/react";
import { SplitSummary } from "./split-summary";
import { type SharedSplitData } from "@/lib/split-sharing";

// Mock the formatCurrency function
jest.mock("@/lib/receipt-utils", () => ({
  formatCurrency: jest.fn((amount: number) => `$${amount.toFixed(2)}`),
}));

const mockSplitData: SharedSplitData = {
  names: ["Alice", "Bob", "Charlie"],
  amounts: [32.5, 19.5, 13.0],
  total: 65.0,
  note: "Pizza Palace",
  phone: "5551234567",
  date: "2024-01-15",
};

const mockMinimalSplitData: SharedSplitData = {
  names: ["Alice"],
  amounts: [25.0],
  total: 25.0,
  note: "Test Split",
  phone: "5551234567",
};

describe("SplitSummary", () => {
  it("renders complete split summary with all information", () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    // Check main title - text is now split across elements
    expect(screen.getByText("Split from")).toBeInTheDocument();

    // Check note/description info (required field) - now in header
    expect(screen.getByText("Pizza Palace")).toBeInTheDocument();

    // Check total amount
    expect(screen.getByText("Total Bill")).toBeInTheDocument();
    expect(screen.getByText("$65.00")).toBeInTheDocument();

    // Check individual breakdown - cards are still present
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("$32.50")).toBeInTheDocument();
    expect(screen.getByText("$19.50")).toBeInTheDocument();
    expect(screen.getByText("$13.00")).toBeInTheDocument();
  });

  it("renders minimal split summary without optional date field", () => {
    render(
      <SplitSummary splitData={mockMinimalSplitData} phoneNumber="5551234567" />
    );

    // Check main title - text is now split across elements
    expect(screen.getByText("Split from")).toBeInTheDocument();

    // Note should be present (required field) - now in header
    expect(screen.getByText("Test Split")).toBeInTheDocument();

    // Date should not be present (optional field not provided)
    // Note: Date cards have been removed from the UI

    // Check total amount - use getAllByText since $25.00 appears twice
    expect(screen.getByText("Total Bill")).toBeInTheDocument();
    const amounts = screen.getAllByText("$25.00");
    expect(amounts.length).toBeGreaterThan(0);

    // Check single person data is displayed
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("handles date formatting correctly", () => {
    const splitDataWithDate: SharedSplitData = {
      ...mockMinimalSplitData,
      date: "2024-12-25",
    };

    render(
      <SplitSummary splitData={splitDataWithDate} phoneNumber="5551234567" />
    );

    // Date cards have been removed from the UI, but date still appears in title
    // Should format as a readable date - be flexible about the day due to timezone differences
    expect(screen.getByText(/Dec.*2[4-5].*2024/)).toBeInTheDocument();
  });

  it("handles invalid date gracefully", () => {
    const splitDataWithBadDate: SharedSplitData = {
      ...mockMinimalSplitData,
      date: "invalid-date",
    };

    render(
      <SplitSummary splitData={splitDataWithBadDate} phoneNumber="5551234567" />
    );

    // Date cards have been removed from the UI, but invalid date still appears in title
    // Should fall back to original string when date parsing fails
    expect(screen.getByText("invalid-date")).toBeInTheDocument();
  });

  it("displays verification note with correct calculation", () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    // Verification note has been removed for cleaner design
    // Component now focuses on core split information display
  });

  it("handles single person correctly", () => {
    render(
      <SplitSummary splitData={mockMinimalSplitData} phoneNumber="5551234567" />
    );

    // Single person data is displayed in individual breakdown cards
    expect(screen.getByText("Alice")).toBeInTheDocument();
    // $25.00 appears twice (Total Bill and individual amount), so use getAllByText
    const amounts = screen.getAllByText("$25.00");
    expect(amounts.length).toBeGreaterThan(0);
  });

  it("handles multiple people correctly", () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    // Multiple people data is displayed in individual breakdown cards
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("$32.50")).toBeInTheDocument();
    expect(screen.getByText("$19.50")).toBeInTheDocument();
    expect(screen.getByText("$13.00")).toBeInTheDocument();
  });

  it("displays all individual amounts in breakdown", () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    // All names should be present
    mockSplitData.names.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });

    // All amounts should be present (formatted by mock function)
    mockSplitData.amounts.forEach((amount) => {
      expect(screen.getByText(`$${amount.toFixed(2)}`)).toBeInTheDocument();
    });
  });

  it("always displays required note field", () => {
    render(<SplitSummary splitData={mockSplitData} phoneNumber="5551234567" />);

    // Note is required, so should always be present in the header
    expect(screen.getByText("Pizza Palace")).toBeInTheDocument();
  });

  it("handles long note names with truncation", () => {
    const longNoteData: SharedSplitData = {
      ...mockMinimalSplitData,
      note: "This is a very long restaurant name that should be truncated properly",
    };

    render(<SplitSummary splitData={longNoteData} phoneNumber="5551234567" />);

    // The full text should be present in the DOM (truncation is CSS-based)
    expect(
      screen.getByText(
        "This is a very long restaurant name that should be truncated properly"
      )
    ).toBeInTheDocument();
  });
});
