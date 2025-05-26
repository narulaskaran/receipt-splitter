import { render, screen } from "@testing-library/react";
import { ResultsSummary } from "./results-summary";
import { type Person } from "@/types";

describe("ResultsSummary", () => {
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
  it("renders people names", () => {
    render(
      <ResultsSummary
        people={people}
        receiptName="Testaurant"
        receiptDate="2024-01-01"
      />
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });
});
