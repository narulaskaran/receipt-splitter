import { render, screen } from "@testing-library/react";
import { ItemAssignment } from "./item-assignment";
import { type Receipt, type Person, type PersonItemAssignment } from "@/types";
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
    expect(screen.getByText(/Burger/)).toBeInTheDocument();
    expect(screen.getByText(/Fries/)).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });
});
