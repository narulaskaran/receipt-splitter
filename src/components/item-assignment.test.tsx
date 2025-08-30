import { render, screen } from "@testing-library/react";
import { ItemAssignment } from "./item-assignment";
import { mockPeople, mockReceipt, mockAssignedItems } from "@/test/test-utils";

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
});
