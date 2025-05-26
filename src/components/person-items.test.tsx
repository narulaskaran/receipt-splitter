import { render, screen } from "@testing-library/react";
import { PersonItems } from "./person-items";
import { type Person } from "@/types";

describe("PersonItems", () => {
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
  it("renders person names", () => {
    render(<PersonItems people={people} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });
});
