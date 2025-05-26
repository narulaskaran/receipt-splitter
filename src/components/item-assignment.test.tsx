import { render, screen } from "@testing-library/react";
import { ItemAssignment } from "./item-assignment";
import { type Receipt, type Person, type PersonItemAssignment } from "@/types";

describe("ItemAssignment", () => {
  const receipt: Receipt = {
    restaurant: "Testaurant",
    date: "2024-01-01",
    subtotal: 100,
    tax: 10,
    tip: 15,
    total: 125,
    items: [
      { name: "Burger", price: 50, quantity: 1 },
      { name: "Fries", price: 25, quantity: 2 },
    ],
  };
  const people: Person[] = [
    {
      id: "a",
      name: "Alice",
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    },
    {
      id: "b",
      name: "Bob",
      items: [],
      totalBeforeTax: 0,
      tax: 0,
      tip: 0,
      finalTotal: 0,
    },
  ];
  // Assign Burger to Alice, Fries to Bob
  const assignedItems = new Map<number, PersonItemAssignment[]>([
    [0, [{ personId: "a", sharePercentage: 100 }]],
    [1, [{ personId: "b", sharePercentage: 100 }]],
  ]);
  it("renders item and people names", () => {
    render(
      <ItemAssignment
        receipt={receipt}
        people={people}
        assignedItems={assignedItems}
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
