import { render, screen, fireEvent, within } from "@testing-library/react";
import { ItemAssignment } from "./item-assignment";
import { mockPeople, mockReceipt, mockAssignedItems } from "@/test/test-utils";
import { toast } from "sonner";

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

  describe("Add Item", () => {
    it("opens add item dialog when Add Item button is clicked", () => {
      render(
        <ItemAssignment
          receipt={mockReceipt}
          people={mockPeople}
          assignedItems={new Map()}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={jest.fn()}
        />
      );

      const addButton = screen.getByRole("button", { name: /add item/i });
      fireEvent.click(addButton);

      expect(screen.getByText(/Add New Item/i)).toBeInTheDocument();
    });

    it("adds item when form is submitted with valid data", () => {
      const onReceiptUpdate = jest.fn();
      render(
        <ItemAssignment
          receipt={mockReceipt}
          people={mockPeople}
          assignedItems={new Map()}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={onReceiptUpdate}
        />
      );

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /add item/i }));

      // Fill form
      const dialog = screen.getByRole("dialog");
      const nameInput = within(dialog).getByLabelText(/item name/i);
      const priceInput = within(dialog).getByLabelText(/price/i);
      const quantityInput = within(dialog).getByLabelText(/quantity/i);

      fireEvent.change(nameInput, { target: { value: "Pizza" } });
      fireEvent.change(priceInput, { target: { value: "12.99" } });
      fireEvent.change(quantityInput, { target: { value: "2" } });

      // Submit - find the submit button (not the header "Add Item" button)
      const submitButton = within(dialog).getByRole("button", { name: /^Add Item$/i });
      fireEvent.click(submitButton);

      // Verify callback was called with updated receipt
      expect(onReceiptUpdate).toHaveBeenCalled();
      const updatedReceipt = onReceiptUpdate.mock.calls[0][0];
      expect(updatedReceipt.items).toHaveLength(mockReceipt.items.length + 1);
      expect(updatedReceipt.items[updatedReceipt.items.length - 1]).toMatchObject({
        name: "Pizza",
        price: 12.99,
        quantity: 2,
      });
      expect(toast.success).toHaveBeenCalledWith('Added "Pizza"');
    });

    it("shows error when item name is empty", () => {
      render(
        <ItemAssignment
          receipt={mockReceipt}
          people={mockPeople}
          assignedItems={new Map()}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /add item/i }));

      const dialog = screen.getByRole("dialog");
      const submitButton = within(dialog).getByRole("button", { name: /^Add Item$/i });
      fireEvent.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith("Item name is required");
    });

    // Note: Price/quantity validation tests removed because HTML5 min attributes
    // and onChange fallbacks (|| 0, || 1) prevent invalid values from reaching
    // the validation logic in saveNewItem()
  });

  describe("Delete Item", () => {
    it("deletes item when delete button is clicked", () => {
      const onReceiptUpdate = jest.fn();
      render(
        <ItemAssignment
          receipt={mockReceipt}
          people={mockPeople}
          assignedItems={new Map()}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={onReceiptUpdate}
        />
      );

      // Find delete button for first item (Burger)
      const deleteButtons = screen.getAllByTitle(/delete item/i);
      fireEvent.click(deleteButtons[0]);

      // Verify callback was called
      expect(onReceiptUpdate).toHaveBeenCalled();
      const updatedReceipt = onReceiptUpdate.mock.calls[0][0];
      expect(updatedReceipt.items).toHaveLength(mockReceipt.items.length - 1);
      expect(toast.success).toHaveBeenCalledWith('Deleted "Burger"');
    });

    it("remaps assignments when deleting item", () => {
      const onReceiptUpdate = jest.fn();
      const testReceipt = {
        ...mockReceipt,
        items: [
          { name: "Item0", price: 10, quantity: 1 },
          { name: "Item1", price: 20, quantity: 1 },
          { name: "Item2", price: 30, quantity: 1 },
        ],
        subtotal: 60,
      };
      const assignments = new Map([
        [0, [{ personId: "a", sharePercentage: 100 }]],
        [2, [{ personId: "b", sharePercentage: 100 }]],
      ]);

      render(
        <ItemAssignment
          receipt={testReceipt}
          people={mockPeople}
          assignedItems={assignments}
          unassignedItems={[1]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={onReceiptUpdate}
        />
      );

      // Delete item at index 1
      const deleteButtons = screen.getAllByTitle(/delete item/i);
      fireEvent.click(deleteButtons[1]);

      // Verify remapped assignments were passed
      expect(onReceiptUpdate).toHaveBeenCalled();
      const remappedAssignments = onReceiptUpdate.mock.calls[0][1];
      expect(remappedAssignments).toBeDefined();
      expect(remappedAssignments.size).toBe(2);
      // Item 0 stays at 0, item 2 shifts to 1
      expect(remappedAssignments.get(0)).toEqual([{ personId: "a", sharePercentage: 100 }]);
      expect(remappedAssignments.get(1)).toEqual([{ personId: "b", sharePercentage: 100 }]);
    });
  });

  describe("Edit Split dialog (custom percentages)", () => {
    /** Find the "Edit Split" pencil button for a given item row.
     *  The pencil button immediately precedes the "Delete item" button in each row. */
    const getEditSplitButton = (itemIndex: number) => {
      const deleteButtons = screen.getAllByTitle(/delete item/i);
      const deleteBtn = deleteButtons[itemIndex];
      return deleteBtn.parentElement!.querySelector("button")! as HTMLElement;
    };

    const threePersonReceipt = {
      ...mockReceipt,
      items: [{ name: "Drinks", price: 30, quantity: 1 }],
      subtotal: 30,
    };
    const threePeople = [
      { id: "a", name: "Alice", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
      { id: "b", name: "Bob", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
      { id: "c", name: "Carol", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
    ];

    it("preserves previously saved custom percentages when dialog is reopened", async () => {
      const customAssignments = new Map([
        [0, [
          { personId: "a", sharePercentage: 28.57 },
          { personId: "b", sharePercentage: 28.57 },
          { personId: "c", sharePercentage: 42.86 },
        ]],
      ]);

      render(
        <ItemAssignment
          receipt={threePersonReceipt}
          people={threePeople}
          assignedItems={customAssignments}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={jest.fn()}
        />
      );

      fireEvent.click(getEditSplitButton(0));

      const dialog = await screen.findByRole("dialog", { name: /Edit Split/i });

      // Custom percentages should be preserved, not reset to equal splits (33.33)
      // Alice and Bob both have 28.57; Carol has 42.86
      expect(within(dialog).getAllByDisplayValue("28.57")).toHaveLength(2);
      expect(within(dialog).getByDisplayValue("42.86")).toBeInTheDocument();
    });

    it("accepts decimal percentages without truncation", async () => {
      // Start with Alice pre-assigned at 100% so her input is enabled
      const singleAssignment = new Map([
        [0, [{ personId: "a", sharePercentage: 100 }]],
      ]);

      render(
        <ItemAssignment
          receipt={threePersonReceipt}
          people={threePeople}
          assignedItems={singleAssignment}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={jest.fn()}
        />
      );

      fireEvent.click(getEditSplitButton(0));

      const dialog = await screen.findByRole("dialog", { name: /Edit Split/i });

      // Alice is pre-assigned; her input is enabled and shows 100
      const aliceInput = within(dialog).getByDisplayValue("100");
      fireEvent.change(aliceInput, { target: { value: "28.57" } });

      // The value should be the decimal 28.57, not the integer-truncated 28
      expect(aliceInput).toHaveValue(28.57);
    });
  });

  describe("Edit Item", () => {
    it("opens edit dialog when edit button is clicked", () => {
      render(
        <ItemAssignment
          receipt={mockReceipt}
          people={mockPeople}
          assignedItems={new Map()}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={jest.fn()}
        />
      );

      // Click edit button for first item
      const editButtons = screen.getAllByTitle(/click to edit/i);
      fireEvent.click(editButtons[0]);

      expect(screen.getByText(/Edit Item: Burger/i)).toBeInTheDocument();
    });

    it("updates item when edit is saved", () => {
      const onReceiptUpdate = jest.fn();
      render(
        <ItemAssignment
          receipt={mockReceipt}
          people={mockPeople}
          assignedItems={new Map()}
          unassignedItems={[]}
          onAssignItems={jest.fn()}
          onReceiptUpdate={onReceiptUpdate}
        />
      );

      // Open edit dialog
      const editButtons = screen.getAllByTitle(/click to edit/i);
      fireEvent.click(editButtons[0]);

      const dialog = screen.getByRole("dialog");
      const priceInput = within(dialog).getByLabelText(/item price/i);
      const quantityInput = within(dialog).getByLabelText(/quantity/i);

      // Change values
      fireEvent.change(priceInput, { target: { value: "15.99" } });
      fireEvent.change(quantityInput, { target: { value: "3" } });

      // Save
      const saveButton = within(dialog).getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      // Verify
      expect(onReceiptUpdate).toHaveBeenCalled();
      const updatedReceipt = onReceiptUpdate.mock.calls[0][0];
      expect(updatedReceipt.items[0]).toMatchObject({
        name: "Burger",
        price: 15.99,
        quantity: 3,
      });
      expect(toast.success).toHaveBeenCalledWith("Item updated successfully");
    });
  });
});
