import { render, screen, within } from "@testing-library/react";
import { EditSplitDialog } from "./edit-split-dialog";

const people = [
  { id: "a", name: "Alice", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
  { id: "b", name: "Bob", items: [], totalBeforeTax: 0, tax: 0, tip: 0, finalTotal: 0 },
];

describe("EditSplitDialog", () => {
  it("restores selected people when assignments are missing", () => {
    render(
      <EditSplitDialog
        open
        onOpenChange={jest.fn()}
        itemIndex={0}
        itemName="Drinks"
        itemPrice={30}
        itemQuantity={1}
        currency="USD"
        people={people}
        existingAssignments={[]}
        selectedPersonIds={["a"]}
        onSave={jest.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: /Edit Split/i });

    expect(within(dialog).getByRole("checkbox", { name: /Alice/i })).toBeChecked();
    expect(within(dialog).getByDisplayValue("100")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: /Bob/i })).not.toBeChecked();
  });
});
