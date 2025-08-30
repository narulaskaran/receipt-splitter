import { render, screen } from "@testing-library/react";
import { ResultsSummary } from "./results-summary";
import { mockPeople } from "@/test/test-utils";

describe("ResultsSummary", () => {
  it("renders people names", () => {
    render(
      <ResultsSummary
        people={mockPeople}
        receiptName="Testaurant"
        receiptDate="2024-01-01"
      />
    );
    expect(screen.getAllByText(/Alice/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Bob/)[0]).toBeInTheDocument();
  });
});
