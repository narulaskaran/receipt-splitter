import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResultsSummary } from "./results-summary";
import { setupGlobalMocks, mockPeople } from "@/test/test-utils";

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
};

Object.defineProperty(navigator, "clipboard", {
  value: mockClipboard,
  writable: true,
});

// Mock window.alert
global.alert = jest.fn();

beforeAll(() => {
  setupGlobalMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClipboard.writeText.mockReset().mockResolvedValue(undefined);
  (global.alert as jest.Mock).mockClear();
  // Suppress console errors during tests
  jest.spyOn(console, "error").mockImplementation(() => {});
  // Ensure navigator.share is undefined by default
  delete (navigator as { share?: unknown }).share;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ResultsSummary", () => {
  describe("Rendering", () => {
    it("renders nothing when no people are provided", () => {
      const { container } = render(
        <ResultsSummary people={[]} receiptName="Test" receiptDate="2024-01-01" />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders results summary with people", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      expect(screen.getByText("Results Summary")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("renders phone number input field", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      expect(phoneInput).toBeInTheDocument();
      expect(phoneInput).toHaveAttribute("type", "tel");
    });

    it("renders Share Split button", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      expect(screen.getByRole("button", { name: /share split/i })).toBeInTheDocument();
    });

    it("renders Share Text button", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      expect(screen.getByRole("button", { name: /share text/i })).toBeInTheDocument();
    });
  });

  describe("People Sorting", () => {
    it("sorts people by final total in descending order", () => {
      const people = [
        { ...mockPeople[0], name: "Alice", finalTotal: 25 },
        { ...mockPeople[1], name: "Bob", finalTotal: 50 },
        { ...mockPeople[0], id: "c", name: "Charlie", finalTotal: 10 },
      ];

      render(
        <ResultsSummary
          people={people}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const rows = screen.getAllByRole("row");
      // Skip header row
      expect(rows[1]).toHaveTextContent("Bob");
      expect(rows[2]).toHaveTextContent("Alice");
      expect(rows[3]).toHaveTextContent("Charlie");
    });
  });

  describe("Table Display", () => {
    it("displays all table headers", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      expect(screen.getByText("Person")).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
      // Desktop-only headers
      expect(screen.getByText("Subtotal")).toBeInTheDocument();
      expect(screen.getByText("Tax")).toBeInTheDocument();
      expect(screen.getByText("Tip")).toBeInTheDocument();
    });

    it("displays person data in table rows", () => {
      const peopleWithTotals = [
        {
          ...mockPeople[0],
          totalBeforeTax: 25,
          tax: 2.5,
          tip: 3.75,
          finalTotal: 31.25,
        },
      ];

      render(
        <ResultsSummary
          people={peopleWithTotals}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("$25.00")).toBeInTheDocument();
      expect(screen.getByText("$2.50")).toBeInTheDocument();
      expect(screen.getByText("$3.75")).toBeInTheDocument();
      expect(screen.getByText("$31.25")).toBeInTheDocument();
    });
  });

  describe("Phone Number Input", () => {
    it("allows entering phone number", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "5551234567" } });

      expect(phoneInput).toHaveValue("5551234567");
    });

    it("filters out non-digit characters from phone input", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "(555) 123-4567" } });

      // The component filters out non-digits
      expect(phoneInput).toHaveValue("5551234567");
    });
  });

  describe("Share Split Button State", () => {
    it("is disabled when phone number is empty", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const shareButton = screen.getByRole("button", { name: /share split/i });
      expect(shareButton).toBeDisabled();
    });

    it("is disabled when phone number is too short", () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "555" } });

      const shareButton = screen.getByRole("button", { name: /share split/i });
      expect(shareButton).toBeDisabled();
    });

    it("is enabled when valid phone number is entered", () => {
      const peopleWithTotals = [
        {
          ...mockPeople[0],
          finalTotal: 25,
        },
      ];

      render(
        <ResultsSummary
          people={peopleWithTotals}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "5551234567" } });

      const shareButton = screen.getByRole("button", { name: /share split/i });
      expect(shareButton).toBeEnabled();
    });

    it("is disabled when people have no totals", () => {
      const peopleWithZeroTotals = mockPeople.map((p) => ({
        ...p,
        finalTotal: 0,
      }));

      render(
        <ResultsSummary
          people={peopleWithZeroTotals}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "5551234567" } });

      const shareButton = screen.getByRole("button", { name: /share split/i });
      expect(shareButton).toBeDisabled();
    });
  });

  describe("Share Split Functionality", () => {
    it("copies shareable URL to clipboard when Share Split is clicked", async () => {
      const peopleWithTotals = [
        {
          ...mockPeople[0],
          finalTotal: 25,
        },
      ];

      render(
        <ResultsSummary
          people={peopleWithTotals}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "5551234567" } });

      const shareButton = screen.getByRole("button", { name: /share split/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
        const clipboardContent = mockClipboard.writeText.mock.calls[0][0];
        expect(clipboardContent).toContain("/split?");
        expect(clipboardContent).toContain("names=");
        expect(clipboardContent).toContain("amounts=");
      });
    });

    it("shows success state after copying", async () => {
      const peopleWithTotals = [
        {
          ...mockPeople[0],
          finalTotal: 25,
        },
      ];

      render(
        <ResultsSummary
          people={peopleWithTotals}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "5551234567" } });

      const shareButton = screen.getByRole("button", { name: /share split/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(screen.getByText("Copied!")).toBeInTheDocument();
      });
    });

    it("handles clipboard write errors gracefully", async () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error("Clipboard error"));

      const peopleWithTotals = [
        {
          ...mockPeople[0],
          finalTotal: 25,
        },
      ];

      render(
        <ResultsSummary
          people={peopleWithTotals}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const phoneInput = screen.getByPlaceholderText("e.g. 555-123-4567");
      fireEvent.change(phoneInput, { target: { value: "5551234567" } });

      const shareButton = screen.getByRole("button", { name: /share split/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining("Failed to copy")
        );
      });
    });
  });

  describe("Share Text Functionality", () => {
    it("copies text summary to clipboard when Share Text is clicked", async () => {
      const peopleWithTotals = [
        {
          ...mockPeople[0],
          name: "Alice",
          finalTotal: 25,
        },
        {
          ...mockPeople[1],
          name: "Bob",
          finalTotal: 30,
        },
      ];

      render(
        <ResultsSummary
          people={peopleWithTotals}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
        const clipboardContent = mockClipboard.writeText.mock.calls[0][0];
        expect(clipboardContent).toContain("Receipt for Test Restaurant");
        expect(clipboardContent).toContain("Alice:");
        expect(clipboardContent).toContain("Bob:");
      });
    });

    it("includes receipt name in shared text", async () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Italian Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        const clipboardContent = mockClipboard.writeText.mock.calls[0][0];
        expect(clipboardContent).toContain("Italian Restaurant");
      });
    });

    it("includes formatted date in shared text", async () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-15"
        />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        const clipboardContent = mockClipboard.writeText.mock.calls[0][0];
        expect(clipboardContent).toContain("Date:");
        expect(clipboardContent).toMatch(/1\/15\/2024/); // toLocaleDateString format
      });
    });

    it("omits receipt name if not provided", async () => {
      render(
        <ResultsSummary people={mockPeople} receiptName={null} receiptDate="2024-01-01" />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        const clipboardContent = mockClipboard.writeText.mock.calls[0][0];
        expect(clipboardContent).not.toContain("Receipt for");
        expect(clipboardContent).toContain("Amount owed by each person:");
      });
    });

    it("omits date if not provided", async () => {
      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate={null}
        />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        const clipboardContent = mockClipboard.writeText.mock.calls[0][0];
        expect(clipboardContent).not.toContain("Date:");
      });
    });

    it("handles clipboard errors with alert", async () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error("Clipboard error"));

      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining("Failed to copy")
        );
      });
    });
  });

  describe("Native Share API", () => {
    it("uses native share API when available", async () => {
      const mockShare = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", {
        value: mockShare,
        writable: true,
        configurable: true,
      });

      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(mockShare).toHaveBeenCalledWith({
          title: "Receipt Split Results",
          text: expect.any(String),
        });
      });

      // Clean up
      delete (navigator as { share?: unknown }).share;
    });

    it("falls back to clipboard when native share fails", async () => {
      const mockShare = jest.fn().mockRejectedValue(new Error("Share canceled"));
      Object.defineProperty(navigator, "share", {
        value: mockShare,
        writable: true,
        configurable: true,
      });

      render(
        <ResultsSummary
          people={mockPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const shareButton = screen.getByRole("button", { name: /share text/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(mockShare).toHaveBeenCalled();
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      // Clean up
      delete (navigator as { share?: unknown }).share;
    });
  });

  describe("Edge Cases", () => {
    it("handles people with zero totals", () => {
      const peopleWithZeros = mockPeople.map((p) => ({
        ...p,
        totalBeforeTax: 0,
        tax: 0,
        tip: 0,
        finalTotal: 0,
      }));

      render(
        <ResultsSummary
          people={peopleWithZeros}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      // Multiple people with $0.00, so use getAllByText
      const zeroAmounts = screen.getAllByText("$0.00");
      expect(zeroAmounts.length).toBeGreaterThan(0);
    });

    it("handles single person", () => {
      const singlePerson = [mockPeople[0]];

      render(
        <ResultsSummary
          people={singlePerson}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      expect(screen.getByText("Alice")).toBeInTheDocument();
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(2); // Header + 1 person
    });

    it("handles many people", () => {
      const manyPeople = Array.from({ length: 10 }, (_, i) => ({
        ...mockPeople[0],
        id: `person-${i}`,
        name: `Person ${i + 1}`,
        finalTotal: (i + 1) * 10,
      }));

      render(
        <ResultsSummary
          people={manyPeople}
          receiptName="Test Restaurant"
          receiptDate="2024-01-01"
        />
      );

      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(11); // Header + 10 people
    });
  });
});
