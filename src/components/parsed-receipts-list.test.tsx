import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ParsedReceiptsList } from "./parsed-receipts-list";
import { createMockReceipt, createStoredReceipt } from "@/test/test-utils";

describe("ParsedReceiptsList", () => {
  it("renders restaurant, date, item count, total, and currency", () => {
    const stored = createStoredReceipt(
      createMockReceipt({
        restaurant: "Cafe",
        date: "2024-03-15",
        total: 42,
        items: [
          { name: "Coffee", price: 21, quantity: 1 },
          { name: "Muffin", price: 21, quantity: 1 },
        ],
      }),
      "r1"
    );

    render(
      <ParsedReceiptsList
        receipts={[stored]}
        onReceiptUpdate={jest.fn()}
        onRemoveReceipt={jest.fn()}
      />
    );

    expect(screen.getAllByText("Cafe").length).toBeGreaterThan(0);
    expect(screen.getByText(/2024-03-15 · 2 items · \$42\.00 · USD/)).toBeInTheDocument();
    expect(screen.getByText("Receipts (1/10)")).toBeInTheDocument();
  });

  it("calls onRemoveReceipt after confirmation", async () => {
    const onRemoveReceipt = jest.fn();
    const stored = createStoredReceipt(
      createMockReceipt({ restaurant: "Cafe" }),
      "r1"
    );

    render(
      <ParsedReceiptsList
        receipts={[stored]}
        onReceiptUpdate={jest.fn()}
        onRemoveReceipt={onRemoveReceipt}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /remove cafe/i }));
    expect(onRemoveReceipt).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/Remove Cafe from this split/);

    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));

    await waitFor(() => {
      expect(onRemoveReceipt).toHaveBeenCalledWith("r1");
    });
  });

  it("does not remove when confirmation is cancelled", () => {
    const onRemoveReceipt = jest.fn();
    const stored = createStoredReceipt(
      createMockReceipt({ restaurant: "Cafe" }),
      "r1"
    );

    render(
      <ParsedReceiptsList
        receipts={[stored]}
        onReceiptUpdate={jest.fn()}
        onRemoveReceipt={onRemoveReceipt}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /remove cafe/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onRemoveReceipt).not.toHaveBeenCalled();
  });

  it("keeps the date and adds #n when restaurant names collide", () => {
    const morning = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "a"
    );
    const evening = createStoredReceipt(
      createMockReceipt({ restaurant: "Starbucks", date: "2024-01-01" }),
      "b"
    );

    render(
      <ParsedReceiptsList
        receipts={[morning, evening]}
        onReceiptUpdate={jest.fn()}
        onRemoveReceipt={jest.fn()}
      />
    );

    expect(
      screen.getByText("Starbucks · 2024-01-01 · #1")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Starbucks · 2024-01-01 · #2")
    ).toBeInTheDocument();
  });
});
