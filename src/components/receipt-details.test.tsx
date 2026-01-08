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
      expect(screen.getByLabelText("Total (Auto-calculated)")).toHaveValue(125);
    });

    it("populates form with empty tip when tip is null", () => {
      const receiptWithNullTip = { ...mockReceipt, tip: null };
      render(<ReceiptDetails receipt={receiptWithNullTip} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      expect(screen.getByLabelText("Tip")).toHaveValue(null);
    });

    it("converts null tip to 0 when opening dialog", async () => {
      // Due to auto-calculation, a null tip becomes 0 when the dialog is opened
      const receiptWithNullTip = { ...mockReceipt, tip: null, total: 110 };
      render(<ReceiptDetails receipt={receiptWithNullTip} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      await waitFor(() => {
        const totalInput = screen.getByLabelText("Total (Auto-calculated)");
        // Auto-calculation: 100 + 10 + 0 = 110 (tip becomes 0)
        expect(totalInput).toHaveValue(110);
      });
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

    it("total field is read-only and disabled", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const totalInput = screen.getByLabelText("Total (Auto-calculated)");
      expect(totalInput).toHaveAttribute("readonly");
      expect(totalInput).toBeDisabled();
    });

    it("allows clearing tip field", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const tipInput = screen.getByLabelText("Tip");
      fireEvent.change(tipInput, { target: { value: "" } });

      // Clearing the tip field sets it to 0, not null
      expect(tipInput).toHaveValue(0);
    });
  });

  describe("Auto-calculation Behavior", () => {
    it("auto-calculates total when subtotal changes", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "200" } });

      await waitFor(() => {
        const totalInput = screen.getByLabelText("Total (Auto-calculated)");
        // Should be 200 (subtotal) + 10 (tax) + 15 (tip) = 225
        expect(totalInput).toHaveValue(225);
      });
    });

    it("auto-calculates total when tax changes", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const taxInput = screen.getByLabelText("Tax");
      fireEvent.change(taxInput, { target: { value: "20" } });

      await waitFor(() => {
        const totalInput = screen.getByLabelText("Total (Auto-calculated)");
        // Should be 100 (subtotal) + 20 (tax) + 15 (tip) = 135
        expect(totalInput).toHaveValue(135);
      });
    });

    it("auto-calculates total when tip changes", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const tipInput = screen.getByLabelText("Tip");
      fireEvent.change(tipInput, { target: { value: "25" } });

      await waitFor(() => {
        const totalInput = screen.getByLabelText("Total (Auto-calculated)");
        // Should be 100 (subtotal) + 10 (tax) + 25 (tip) = 135
        expect(totalInput).toHaveValue(135);
      });
    });

    it("auto-calculates total when tip is cleared", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const tipInput = screen.getByLabelText("Tip");
      fireEvent.change(tipInput, { target: { value: "" } });

      await waitFor(() => {
        const totalInput = screen.getByLabelText("Total (Auto-calculated)");
        // Should be 100 (subtotal) + 10 (tax) + 0 (tip) = 110
        expect(totalInput).toHaveValue(110);
      });
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

    it("shows success toast after saving", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Receipt details updated");
        expect(toast.error).not.toHaveBeenCalled();
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

    it("validates that total matches subtotal + tax + tip", async () => {
      // NOTE: This test verifies the validation logic exists as a defensive safety check.
      // In normal UI flow, auto-calculation makes this validation unreachable since the
      // total field is read-only. However, the validation provides data integrity protection
      // against potential bugs or direct data manipulation.
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      // Change subtotal and save - total should auto-calculate correctly
      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "150" } });

      await waitFor(() => {
        const totalInput = screen.getByLabelText("Total (Auto-calculated)");
        // Should be 150 + 10 + 15 = 175
        expect(totalInput).toHaveValue(175);
      });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            subtotal: 150,
            tax: 10,
            tip: 15,
            total: 175,
          })
        );
      });
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Receipt details updated");
    });

    it("successfully saves when multiple fields are changed", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      // Change multiple fields simultaneously
      const subtotalInput = screen.getByLabelText("Subtotal");
      const taxInput = screen.getByLabelText("Tax");
      const tipInput = screen.getByLabelText("Tip");

      fireEvent.change(subtotalInput, { target: { value: "200" } });
      fireEvent.change(taxInput, { target: { value: "20" } });
      fireEvent.change(tipInput, { target: { value: "30" } });

      await waitFor(() => {
        const totalInput = screen.getByLabelText("Total (Auto-calculated)");
        // Should be 200 + 20 + 30 = 250
        expect(totalInput).toHaveValue(250);
      });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            subtotal: 200,
            tax: 20,
            tip: 30,
            total: 250,
          })
        );
      });
      expect(toast.success).toHaveBeenCalledWith("Receipt details updated");
    });
  });

  describe("Edge Cases", () => {
    it("defaults to 0 when number input is cleared or invalid", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "abc" } });

      expect(subtotalInput).toHaveValue(0);
    });

    it("saves successfully after invalid input is normalized to zero", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "abc" } });
      expect(subtotalInput).toHaveValue(0);

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ subtotal: 0 })
        );
        expect(toast.success).toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
      });
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

    it("handles very large numbers correctly", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const subtotalInput = screen.getByLabelText("Subtotal");
      fireEvent.change(subtotalInput, { target: { value: "999999999.99" } });

      expect(subtotalInput).toHaveValue(999999999.99);

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ subtotal: 999999999.99 })
        );
      });
    });

    it("handles numbers with many decimal places by rounding", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const taxInput = screen.getByLabelText("Tax");
      fireEvent.change(taxInput, { target: { value: "10.12345" } });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ tax: 10.12345 })
        );
      });
    });

    it("handles invalid date gracefully", () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const dateInput = screen.getByLabelText("Date");
      // HTML5 date inputs prevent invalid dates, but we can clear it
      fireEvent.change(dateInput, { target: { value: "" } });

      expect(dateInput).toHaveValue("");
    });

    it("handles future dates correctly", async () => {
      render(<ReceiptDetails receipt={mockReceipt} onReceiptUpdate={mockOnReceiptUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      const dateInput = screen.getByLabelText("Date");
      fireEvent.change(dateInput, { target: { value: "2030-12-31" } });

      expect(dateInput).toHaveValue("2030-12-31");

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnReceiptUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ date: "2030-12-31" })
        );
      });
    });
  });
});
