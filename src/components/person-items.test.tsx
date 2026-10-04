import { render, screen } from "@testing-library/react";
import { PersonItemBreakdown } from "./person-items";
import { mockPeople } from "@/test/test-utils";
import { type Person, type PersonItem } from "@/types";

function personWithItems(items: PersonItem[], overrides: Partial<Person> = {}): Person {
  return {
    ...mockPeople[0],
    items,
    totalBeforeTax: items.reduce((sum, item) => sum + item.amount, 0),
    tax: 1,
    tip: 2,
    finalTotal: 20,
    ...overrides,
  };
}

describe("PersonItemBreakdown", () => {
  it("shows a placeholder when the person has no items", () => {
    render(<PersonItemBreakdown person={personWithItems([])} />);
    expect(screen.getByText("No items assigned")).toBeInTheDocument();
  });

  it("shows the share only for partially shared items", () => {
    render(
      <PersonItemBreakdown
        person={personWithItems([
          { itemId: 0, itemName: "Fries", originalPrice: 6, quantity: 1, sharePercentage: 50, amount: 3 },
          { itemId: 1, itemName: "Soda", originalPrice: 2, quantity: 1, sharePercentage: 100, amount: 2 },
        ])}
      />
    );
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("groups expanded items by receipt", () => {
    const people = [
      personWithItems([
        {
          itemId: 0,
          itemName: "Latte",
          originalPrice: 5,
          quantity: 1,
          sharePercentage: 100,
          amount: 5,
          receiptId: "r1",
          receiptName: "Coffee Shop",
        },
        {
          itemId: 0,
          itemName: "Burger",
          originalPrice: 12,
          quantity: 1,
          sharePercentage: 100,
          amount: 12,
          receiptId: "r2",
          receiptName: "Lunch Place",
        },
      ]),
    ];

    render(<PersonItemBreakdown person={people[0]} />);

    const headings = screen.getAllByTestId("receipt-group-heading");
    expect(headings.map((el) => el.textContent)).toEqual([
      "Coffee Shop",
      "Lunch Place",
    ]);
    expect(screen.getByText("Latte")).toBeInTheDocument();
    expect(screen.getByText("Burger")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getByText("Tip")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("keeps an ungrouped table when items have no receiptId", () => {
    const people = [
      personWithItems([
        {
          itemId: 0,
          itemName: "Burger",
          originalPrice: 50,
          quantity: 1,
          sharePercentage: 100,
          amount: 50,
        },
      ]),
    ];

    render(<PersonItemBreakdown person={people[0]} />);

    expect(screen.getByText("Burger")).toBeInTheDocument();
    expect(screen.queryByTestId("receipt-group-heading")).not.toBeInTheDocument();
    expect(screen.queryByText("Receipt")).not.toBeInTheDocument();
  });
});
