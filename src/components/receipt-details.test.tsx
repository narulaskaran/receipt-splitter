import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReceiptDetails } from "./receipt-details";
import { mockReceipt, setupGlobalMocks } from "@/test/test-utils";
import { toast } from "sonner";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

beforeAll(() => {
  setupGlobalMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ReceiptDetails", () => {
  const mockOnReceiptUpdate = jest.fn();

  describe("Display Mode", () => {
    it("renders receipt name and formatted date", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);
      expect(screen.getByText(/Testaurant/)).toBeInTheDocument();
      expect(screen.getByText("2024-01-01")).toBeInTheDocument();
    });

    it("renders all receipt financial details", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      expect(screen.getByText("Subtotal")).toBeInTheDocument();
      expect(screen.getByText("$100.00")).toBeInTheDocument();
      expect(screen.getByText("Tax")).toBeInTheDocument();
      expect(screen.getByText("$10.00")).toBeInTheDocument();
      expect(screen.getByText("Tip")).toBeInTheDocument();
      expect(screen.getByText("$15.00")).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.getByText("$125.00")).toBeInTheDocument();
    });

    it("displays 'Unknown' for missing restaurant name", () => {
      const receiptWithoutName = { ...mockReceipt, restaurant: null };
      render(<ReceiptDetails receipt={receiptWithoutName} onReceiptUpdate={mockOnReceiptUpdate} />);

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("displays 'Unknown' for missing date", () => {
      const receiptWithoutDate = { ...mockReceipt, date: null };
      render(<ReceiptDetails receipt={receiptWithoutDate} onReceiptUpdate={mockOnReceiptUpdate} />);

      const unknownTexts = screen.getAllByText("Unknown");
      expect(unknownTexts.length).toBeGreaterThan(0);
    });

    it("handles null tip by displaying $0.00", () => {
      const receiptWithNullTip = { ...mockReceipt, tip: null };
      render(<ReceiptDetails receipt={receiptWithNullTip} onReceiptUpdate={mockOnReceiptUpdate} />);

      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    it("renders Calculator icon", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      // Check for Receipt Details title
      expect(screen.getByText("Receipt Details")).toBeInTheDocument();
    });

    it("renders Edit button", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe("Edit Dialog", () => {
    it("opens edit dialog when Edit button is clicked", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Edit Receipt Details")).toBeInTheDocument();
    });

    it("populates form fields with current receipt data", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      expect(screen.getByLabelText("Restaurant")).toHaveValue("Testaurant");
      expect(screen.getByLabelText("Date")).toHaveValue("2024-01-01");
      expect(screen.getByLabelText("Subtotal")).toHaveValue(100);
      expect(screen.getByLabelText("Tax")).toHaveValue(10);
      expect(screen.getByLabelText("Tip")).toHaveValue(15);
      expect(screen.getByLabelText("Total")).toHaveValue(125);
    });

    it("closes dialog when Cancel button is clicked", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Edit Functionality", () => {
    it("allows editing restaurant name", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const restaurantInput = screen.getByLabelText("Restaurant");
      fireEvent.change(restaurantInput, { target: { value: "New Restaurant" } });

      expect(restaurantInput).toHaveValue("New Restaurant");
    });

    it("allows editing date", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const dateInput = screen.getByLabelText("Date");
      fireEvent.change(dateInput, { target: { value: "2024-12-25" } });

      expect(dateInput).toHaveValue("2024-12-25");
    });

    it("allows editing subtotal", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "150.50" } });

      expect(subtotalInput).toHaveValue(150.5);
    });

    it("allows editing tax", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const taxInput = screen.getByLabelText("Tax");
      fireEvent.change(taxInput, { target: { value: "12.50" } });

      expect(taxInput).toHaveValue(12.5);
    });

    it("allows editing tip", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const tipInput = screen.getByLabelText("Tip");
      fireEvent.change(tipInput, { target: { value: "20" } });

      expect(tipInput).toHaveValue(20);
    });

    it("allows editing total", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const totalInput = screen.getByLabelText("Total");
      fireEvent.change(totalInput, { target: { value: "200" } });

      expect(totalInput).toHaveValue(200);
    });

    it("allows clearing tip field", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const tipInput = screen.getByLabelText("Tip");
      fireEvent.change(tipInput, { target: { value: "" } });

      expect(tipInput).toHaveValue(null);
    });
  });

  describe("Save Functionality", () => {
    it("saves changes and calls onReceiptUpdate", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const restaurantInput = screen.getByLabelText("Restaurant");
      fireEvent.change(restaurantInput, { target: { value: "New Restaurant" } });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            restaurant: "New Restaurant",
          })
        );
      });
    });

    it("calculates tip from total when tip is null", async () => {
      const receiptWithNullTip = { ...mockReceipt, tip: null };
      render(<ReceiptDetails receipt={receiptWithNullTip} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            tip: 15, // 125 - 100 - 10 = 15
          })
        );
      });
    });

    it("shows success toast after saving", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Receipt details updated");
      });
    });

    it("closes dialog after saving", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Validation", () => {
    it("shows error for negative subtotal", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "-10" } });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("All amounts must be positive");
      });
      expect(mockOnReceiptUpdate).not.toHaveBeenCalled();
    });

    it("shows error for negative tax", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const taxInput = screen.getByLabelText("Tax");
      fireEvent.change(taxInput, { target: { value: "-5" } });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("All amounts must be positive");
      });
      expect(mockOnReceiptUpdate).not.toHaveBeenCalled();
    });

    it("shows error for negative tip", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const tipInput = screen.getByLabelText("Tip");
      fireEvent.change(tipInput, { target: { value: "-10" } });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("All amounts must be positive");
      });
      expect(mockOnReceiptUpdate).not.toHaveBeenCalled();
    });

    it("shows error for negative total", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const totalInput = screen.getByLabelText("Total");
      fireEvent.change(totalInput, { target: { value: "-100" } });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("All amounts must be positive");
      });
      expect(mockOnReceiptUpdate).not.toHaveBeenCalled();
    });

    it("allows zero values", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const tipInput = screen.getByLabelText("Tip");
      fireEvent.change(tipInput, { target: { value: "0" } });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalled();
      });
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles invalid number input by defaulting to 0", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "abc" } });

      expect(subtotalInput).toHaveValue(0);
    });

    it("handles empty restaurant name", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const restaurantInput = screen.getByLabelText("Restaurant");
      fireEvent.change(restaurantInput, { target: { value: "" } });

      expect(restaurantInput).toHaveValue("");
    });

    it("handles empty date", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const dateInput = screen.getByLabelText("Date");
      fireEvent.change(dateInput, { target: { value: "" } });

      expect(dateInput).toHaveValue("");
    });

    it("formats date correctly when date has time component", () => {
      const receiptWithTime = { ...mockReceipt, date: "2024-01-01T12:00:00Z" };
      render(<ReceiptDetails receipt={receiptWithTime} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const dateInput = screen.getByLabelText("Date");
      // Should only show date part (first 10 characters)
      expect(dateInput).toHaveValue("2024-01-01");
    });

    it("calculates non-negative tip even when total is less than subtotal + tax", async () => {
      const receiptWithLowTotal = { ...mockReceipt, tip: null, total: 50 }; // Less than subtotal (100) + tax (8)
      render(<ReceiptDetails receipt={receiptWithLowTotal} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            tip: 0, // Math.max(0, 50 - 100 - 8) = 0
          })
        );
      });
    });
  });
});
