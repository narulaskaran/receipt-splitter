import { render, screen, fireEvent } from "@testing-library/react";
import { PersonItems } from "./person-items";
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

describe("PersonItems", () => {
  it("renders person names", () => {
    render(<PersonItems people={mockPeople} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
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

    render(<PersonItems people={people} />);
    fireEvent.click(screen.getByText("Alice"));

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

    render(<PersonItems people={people} />);
    fireEvent.click(screen.getByText("Alice"));

    expect(screen.getByText("Burger")).toBeInTheDocument();
    expect(screen.queryByTestId("receipt-group-heading")).not.toBeInTheDocument();
    expect(screen.queryByText("Receipt")).not.toBeInTheDocument();
  });
});
