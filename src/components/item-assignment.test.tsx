import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemAssignment } from "./item-assignment";
import { mockPeople, mockReceipt, mockAssignedItems } from "@/test/test-utils";

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("ItemAssignment", () => {
  it("renders item and people names", () => {
    render(
      <ItemAssignment
        receipt={mockReceipt}
        people={mockPeople}
        assignedItems={mockAssignedItems}
        unassignedItems={[]}
        onAssignItems={() => {}}
        onReceiptUpdate={() => {}}
      />
    );
    // Use getAllByText since we now have both desktop and mobile views
    expect(screen.getAllByText(/Burger/)).toHaveLength(2);
    expect(screen.getAllByText(/Fries/)).toHaveLength(2);
    // Alice and Bob appear in assignment summaries in both desktop and mobile views
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bob/).length).toBeGreaterThan(0);
  });

  it("renders add item button", () => {
    render(
      <ItemAssignment
        receipt={mockReceipt}
        people={mockPeople}
        assignedItems={mockAssignedItems}
        unassignedItems={[]}
        onAssignItems={() => {}}
        onReceiptUpdate={() => {}}
      />
    );
    expect(screen.getByText(/Add Item/)).toBeInTheDocument();
  });

  it("opens add item dialog when add button is clicked", async () => {
    render(
      <ItemAssignment
        receipt={mockReceipt}
        people={mockPeople}
        assignedItems={mockAssignedItems}
        unassignedItems={[]}
        onAssignItems={() => {}}
        onReceiptUpdate={() => {}}
      />
    );

    const addButton = screen.getByText(/Add Item/);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/Add New Item/)).toBeInTheDocument();
    });
  });

  it("calls onReceiptUpdate when adding a new item", async () => {
    const onReceiptUpdate = jest.fn();
    const user = userEvent.setup();

    render(
      <ItemAssignment
        receipt={mockReceipt}
        people={mockPeople}
        assignedItems={mockAssignedItems}
        unassignedItems={[]}
        onAssignItems={() => {}}
        onReceiptUpdate={onReceiptUpdate}
      />
    );

    // Click add item button
    const addButton = screen.getByText(/Add Item/);
    await user.click(addButton);

    // Fill in the form
    await waitFor(() => {
      expect(screen.getByLabelText(/Item Name/)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Item Name/);
    const priceInput = screen.getByLabelText(/Item Price/);
    const quantityInput = screen.getByLabelText(/Quantity/);

    await user.clear(nameInput);
    await user.type(nameInput, "Pizza");
    await user.clear(priceInput);
    await user.type(priceInput, "15.99");
    await user.clear(quantityInput);
    await user.type(quantityInput, "2");

    // Submit the form
    const submitButton = screen.getByText(/^Add Item$/);
    await user.click(submitButton);

    // Verify onReceiptUpdate was called with the new item
    await waitFor(() => {
      expect(onReceiptUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              name: "Pizza",
              price: 15.99,
              quantity: 2,
            }),
          ]),
          subtotal: expect.any(Number),
        })
      );
    });
  });

  it("renders delete buttons for each item", () => {
    render(
      <ItemAssignment
        receipt={mockReceipt}
        people={mockPeople}
        assignedItems={mockAssignedItems}
        unassignedItems={[]}
        onAssignItems={() => {}}
        onReceiptUpdate={() => {}}
      />
    );

    // Should have delete buttons (2 items * 2 views = 4 buttons)
    const deleteButtons = screen.getAllByTitle(/Delete item/);
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onReceiptUpdate when deleting an item", async () => {
    const onReceiptUpdate = jest.fn();

    render(
      <ItemAssignment
        receipt={mockReceipt}
        people={mockPeople}
        assignedItems={mockAssignedItems}
        unassignedItems={[]}
        onAssignItems={() => {}}
        onReceiptUpdate={onReceiptUpdate}
      />
    );

    // Get the first delete button and click it
    const deleteButtons = screen.getAllByTitle(/Delete item/);
    fireEvent.click(deleteButtons[0]);

    // Verify onReceiptUpdate was called with one less item
    await waitFor(() => {
      expect(onReceiptUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              name: "Fries",
            }),
          ]),
        })
      );
      // Should only have 1 item left (Fries)
      const call = onReceiptUpdate.mock.calls[0][0];
      expect(call.items).toHaveLength(1);
    });
  });

  it("validates item name when adding", async () => {
    const onReceiptUpdate = jest.fn();
    const user = userEvent.setup();

    render(
      <ItemAssignment
        receipt={mockReceipt}
        people={mockPeople}
        assignedItems={mockAssignedItems}
        unassignedItems={[]}
        onAssignItems={() => {}}
        onReceiptUpdate={onReceiptUpdate}
      />
    );

    // Click add item button
    const addButton = screen.getByText(/Add Item/);
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Item Name/)).toBeInTheDocument();
    });

    // Try to submit without a name
    const submitButton = screen.getByText(/^Add Item$/);
    await user.click(submitButton);

    // Should not call onReceiptUpdate
    expect(onReceiptUpdate).not.toHaveBeenCalled();
  });
});
